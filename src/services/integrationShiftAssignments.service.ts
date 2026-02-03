import crypto from "crypto";
import { DateTime } from "luxon";
import { Prisma, IntegrationLogStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildShiftSignature } from "@/src/services/shiftPlan.service";
import { createIntegrationLogRepo, finalizeIntegrationLogRepo } from "@/src/repositories/integration.repo";
import {
  sendIntegrationCallback,
  summarizeCallbackForMeta,
  type IntegrationCallbackConfig,
} from "@/src/services/integrationWebhook.service";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type DayPayload = null | {
  shiftTemplateSignature?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
};

type PlanInput = {
  externalRef: string;
  employeeExternalRef?: string | null;
  employeeCode?: string | null;
  weekStartDate: string; // YYYY-MM-DD (any day in week allowed)
  defaultShiftTemplateSignature?: string | null;
  days?: Partial<Record<DayKey, DayPayload>>;
  isCancelled?: boolean;
};

type BatchInput = {
  sourceSystem: string;
  batchRef?: string | null;
  plans: PlanInput[];
  callback?: IntegrationCallbackConfig | null;
};

export type IntegrationShiftPlanResult =
  | {
      externalRef: string;
      status: "CREATED" | "UPDATED" | "UNCHANGED" | "CANCELLED";
      weeklyShiftPlanId?: string;
      employeeId?: string;
      weekStartDate?: string; // local monday ISO date
      weekStartDateUtc?: Date;
      willStatus?: "WILL_CREATE" | "WILL_UPDATE" | "WILL_UNCHANGED" | "WILL_CANCEL" | null;
    }
  | { externalRef: string; status: "FAILED"; error: { code: string; message: string; details?: any } };

function stableHash(obj: any) {
  const s = JSON.stringify(obj);
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function normStr(v: any) {
  const s = String(v ?? "").trim();
  return s || "";
}

function hasOwn(o: any, k: string) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function toMondayWeekStartUtc(anyDateIso: string, tz: string) {
  const dt = DateTime.fromISO(anyDateIso, { zone: tz });
  if (!dt.isValid) return { ok: false as const, error: "invalid_date" as const };
  const localDay = dt.startOf("day");
  const weekday = localDay.weekday; // 1=Mon ... 7=Sun
  const mondayLocal = localDay.minus({ days: weekday - 1 }).startOf("day");
  const mondayUtc = mondayLocal.toUTC();
  return { ok: true as const, mondayLocal, mondayUtc, weekStartUtcDate: mondayUtc.toJSDate() };
}

async function resolveTemplateIdBySignature(companyId: string, signature: string) {
  const sig = normStr(signature);
  if (!sig) return null;
  // 1) Fast path: active only
  const active = await prisma.shiftTemplate.findFirst({
    where: { companyId, signature: sig, isActive: true },
    select: { id: true },
  });
  if (active?.id) return active.id;

  // 2) If not found, allow inactive and auto-activate (SAP flows may send assignment before template upsert)
  const anyTpl = await prisma.shiftTemplate.findFirst({
    where: { companyId, signature: sig },
    select: { id: true, isActive: true },
  });
  if (!anyTpl?.id) return null;

  if (!anyTpl.isActive) {
   await prisma.shiftTemplate.update({
      where: { id: anyTpl.id },
      data: { isActive: true },
      select: { id: true },
    });
  }
  return anyTpl.id;
}

export async function integrationUpsertShiftAssignments(input: BatchInput, ctx: {
  requestId: string;
  endpoint: string;
  ip: string | null;
  apiKeyHash: string;
  dryRun?: boolean;
}) {
  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const dryRun = !!ctx.dryRun;

  const sourceSystem = normStr(input.sourceSystem);
  if (!sourceSystem) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "sourceSystem is required" } },
    };
  }

  const plans = Array.isArray(input.plans) ? input.plans : [];
  if (plans.length < 1) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "plans must be a non-empty array" } },
    };
  }

  const maxBatch = Number(process.env.INTEGRATION_MAX_BATCH_SIZE ?? "500");
  const maxBatchSafe = Number.isFinite(maxBatch) && maxBatch > 0 ? Math.trunc(maxBatch) : 500;
  if (plans.length > maxBatchSafe) {
    return {
      ok: false as const,
      status: 413,
      body: {
        requestId: ctx.requestId,
        error: { code: "PAYLOAD_TOO_LARGE", message: `plans batch size exceeds limit (${maxBatchSafe})` },
      },
    };
  }

  if (!dryRun) {
    await createIntegrationLogRepo({
      companyId,
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      sourceSystem,
      batchRef: input.batchRef ?? null,
      ip: ctx.ip,
      apiKeyHash: ctx.apiKeyHash,
      payloadMeta: { count: plans.length },
    });
  }

  // small in-request cache for template signatures
  const templateCache = new Map<string, string | null>();
  async function tplId(sig: string) {
    const key = normStr(sig);
    if (!key) return null;
    if (templateCache.has(key)) return templateCache.get(key)!;
    const id = await resolveTemplateIdBySignature(companyId, key);
    templateCache.set(key, id);
    return id;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  let willCreate = 0;
  let willUpdate = 0;
  let willUnchanged = 0;
  let willCancel = 0;
  const results: IntegrationShiftPlanResult[] = [];
  const errors: any[] = [];

  for (const raw of plans) {
    const externalRef = normStr((raw as any)?.externalRef);
    const employeeExternalRef = hasOwn(raw, "employeeExternalRef") ? normStr((raw as any)?.employeeExternalRef) : "";
    const employeeCode = hasOwn(raw, "employeeCode") ? normStr((raw as any)?.employeeCode) : "";
    const weekStartDate = normStr((raw as any)?.weekStartDate);
    const isCancelled = hasOwn(raw, "isCancelled") ? !!raw.isCancelled : false;
    const defaultShiftSig = hasOwn(raw, "defaultShiftTemplateSignature")
      ? ((raw as any)?.defaultShiftTemplateSignature === null ? null : normStr((raw as any)?.defaultShiftTemplateSignature))
      : undefined;

    const days = (raw as any)?.days ?? undefined;

    if (!externalRef) {
      failed++;
      const err = { externalRef: "(missing)", code: "VALIDATION_ERROR", message: "externalRef is required" };
      results.push({ externalRef: "(missing)", status: "FAILED", error: { code: err.code, message: err.message } });
      errors.push(err);
      continue;
    }

    if (!isCancelled) {
      if (!weekStartDate || (!employeeExternalRef && !employeeCode)) {
        failed++;
        const err = {
          externalRef,
          code: "VALIDATION_ERROR",
          message: "employeeExternalRef (or employeeCode) and weekStartDate are required",
        };
        results.push({ externalRef, status: "FAILED", error: { code: err.code, message: err.message } });
        errors.push(err);
        continue;
      }
    }

    // payload hash for unchanged detection
    const payloadHash = stableHash({
      externalRef,
      ...(employeeExternalRef ? { employeeExternalRef } : {}),
      ...(employeeCode ? { employeeCode } : {}),
      ...(weekStartDate ? { weekStartDate } : {}),
      ...(defaultShiftSig !== undefined ? { defaultShiftSig } : {}),
      ...(days !== undefined ? { days } : {}),
      isCancelled,
    });

    try {
      const r = await prisma.$transaction(async (tx) => {
        // Existing link?
        const link = await tx.integrationWeeklyShiftPlanLink.findFirst({
          where: { companyId, sourceSystem, externalRef },
        });

        // Cancel flow
        if (isCancelled) {
          if (!link) return { ok: true as const, action: "UNCHANGED" as const };
          if (!dryRun) {
            await tx.integrationWeeklyShiftPlanLink.delete({
              where: { companyId_sourceSystem_externalRef: { companyId, sourceSystem, externalRef } },
            });
            await tx.weeklyShiftPlan.delete({ where: { id: link.weeklyShiftPlanId } });
          }
          return { ok: true as const, action: "CANCELLED" as const };
        }

        // Resolve employee
        let employeeId: string | null = null;
        if (employeeExternalRef) {
          const empLink = await tx.integrationEmployeeLink.findFirst({
            where: { companyId, sourceSystem, externalRef: employeeExternalRef },
            select: { employeeId: true },
          });
          if (empLink?.employeeId) employeeId = empLink.employeeId;
        }
        if (!employeeId && employeeCode) {
          const emp = await tx.employee.findFirst({ where: { companyId, employeeCode }, select: { id: true } });
          if (emp?.id) employeeId = emp.id;
        }
        if (!employeeId) {
          return {
            ok: false as const,
            error: { code: "EMPLOYEE_NOT_FOUND", message: "employee not found for plan", details: { employeeExternalRef, employeeCode } },
          };
        }

        // Canonical week start (Monday local 00:00 -> UTC)
        const w = toMondayWeekStartUtc(weekStartDate, tz);
        if (!w.ok) {
          return { ok: false as const, error: { code: "INVALID_WEEK_DATE", message: "invalid weekStartDate" } };
        }
        const weekStartUtc = w.weekStartUtcDate;

        // Unchanged detection by hash (only if link exists)
        if (link?.lastPayloadHash && link.lastPayloadHash === payloadHash) {
          return {
            ok: true as const,
            action: "UNCHANGED" as const,
            weeklyShiftPlanId: link.weeklyShiftPlanId,
            employeeId,
            weekStartIso: w.mondayLocal.toISODate(),
            weekStartUtc: w.weekStartUtcDate,
          };
        }

        // Build update payload for WeeklyShiftPlan
        const data: any = {
          employeeId,
          companyId,
          weekStartDate: weekStartUtc,
        };

        // Default shift template
        if (defaultShiftSig !== undefined) {
          if (defaultShiftSig === null) {
            data.shiftTemplateId = null;
          } else if (defaultShiftSig) {
            const id = await tplId(defaultShiftSig);
            if (!id) {
              return { ok: false as const, error: { code: "SHIFT_TEMPLATE_NOT_FOUND", message: "default shift template not found", details: { signature: defaultShiftSig } } };
            }
            data.shiftTemplateId = id;
          } else {
            data.shiftTemplateId = null;
          }
        }

        // Day-level mapping
        if (days && typeof days === "object") {
          for (const k of DAY_KEYS) {
            const v: DayPayload = (days as any)[k];
            // allow explicit null to clear everything
            if (v === null) {
              data[`${k}ShiftTemplateId`] = null;
              data[`${k}StartMinute`] = null;
              data[`${k}EndMinute`] = null;
              continue;
            }
            if (!v || typeof v !== "object") continue;

            if (hasOwn(v, "shiftTemplateSignature")) {
              const sig = (v as any).shiftTemplateSignature;
              if (sig === null) {
                data[`${k}ShiftTemplateId`] = null;
              } else {
                const s = normStr(sig);
                if (!s) {
                  data[`${k}ShiftTemplateId`] = null;
                } else {
                  const id = await tplId(s);
                  if (!id) {
                    return { ok: false as const, error: { code: "SHIFT_TEMPLATE_NOT_FOUND", message: "day shift template not found", details: { day: k, signature: s } } };
                  }
                  data[`${k}ShiftTemplateId`] = id;
                }
              }
            }
            if (hasOwn(v, "startMinute")) {
              const sm = (v as any).startMinute;
              data[`${k}StartMinute`] = sm === null || sm === undefined ? null : Math.trunc(Number(sm));
            }
            if (hasOwn(v, "endMinute")) {
              const em = (v as any).endMinute;
              data[`${k}EndMinute`] = em === null || em === undefined ? null : Math.trunc(Number(em));
            }
          }
        }

        // Determine existing plan
        let plan: any = null;
        let mode: "CREATE" | "UPDATE" = "UPDATE";

        if (link?.weeklyShiftPlanId) {
          plan = await tx.weeklyShiftPlan.findFirst({
            where: { id: link.weeklyShiftPlanId, companyId },
            select: { id: true, employeeId: true, weekStartDate: true },
          });
          if (!plan) plan = null;
        }

        if (plan) {
          // Immutable guard: externalRef shouldn't move to another employee/week
          if (plan.employeeId !== employeeId || plan.weekStartDate.getTime() !== weekStartUtc.getTime()) {
            return {
              ok: false as const,
              error: {
                code: "IMMUTABLE_MISMATCH",
                message: "existing externalRef is bound to a different employee/weekStartDate",
                details: { existingEmployeeId: plan.employeeId },
              },
            };
          }
          mode = "UPDATE";
          if (!dryRun) {
            plan = await tx.weeklyShiftPlan.update({
              where: { id: plan.id },
              data,
              select: { id: true },
            });
          } else {
            plan = { id: plan.id };
          }
        } else {
          // No link: try find existing plan for employee/week to avoid duplicates
          const existing = await tx.weeklyShiftPlan.findFirst({
            where: { companyId, employeeId, weekStartDate: weekStartUtc },
            select: { id: true },
          });
          if (existing) {
            mode = "UPDATE";
            if (!dryRun) {
              plan = await tx.weeklyShiftPlan.update({
                where: { id: existing.id },
                data,
                select: { id: true },
              });
            } else {
              plan = { id: existing.id };
            }
          } else {
            mode = "CREATE";
            if (!dryRun) {
              plan = await tx.weeklyShiftPlan.create({
                data,
                select: { id: true },
              });
            } else {
              plan = { id: "__DRY__" };
            }
          }
        }

        // Upsert link
        if (!dryRun && plan.id !== "__DRY__") {
          await tx.integrationWeeklyShiftPlanLink.upsert({
            where: { companyId_sourceSystem_externalRef: { companyId, sourceSystem, externalRef } },
            create: {
              companyId,
              sourceSystem,
              externalRef,
              employeeId,
              weeklyShiftPlanId: plan.id,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
            update: {
              employeeId,
              weeklyShiftPlanId: plan.id,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
          });
        }

        return {
          ok: true as const,
          action: mode === "CREATE" ? "CREATED" as const : "UPDATED" as const,
          weeklyShiftPlanId: plan.id,
          employeeId,
          weekStartIso: w.mondayLocal.toISODate(),
          weekStartUtc: w.weekStartUtcDate,
        };
      });

      if (!r.ok) {
        failed++;
        results.push({ externalRef, status: "FAILED", error: r.error });
        errors.push({ externalRef, ...r.error });
        continue;
      }

      if (r.action === "CREATED") {
        created++;
        if (dryRun) willCreate++;
        results.push({
          externalRef,
          status: "CREATED",
          weeklyShiftPlanId: r.weeklyShiftPlanId,
          employeeId: r.employeeId,
          weekStartDate: r.weekStartIso,
          weekStartDateUtc: r.weekStartUtc,
          willStatus: dryRun ? "WILL_CREATE" : null,
        });
        continue;
      }
      if (r.action === "UPDATED") {
        updated++;
        if (dryRun) willUpdate++;
        results.push({
          externalRef,
          status: "UPDATED",
          weeklyShiftPlanId: r.weeklyShiftPlanId,
          employeeId: r.employeeId,
          weekStartDate: r.weekStartIso,
          weekStartDateUtc: r.weekStartUtc,
          willStatus: dryRun ? "WILL_UPDATE" : null,
        });
        continue;
      }
      if (r.action === "CANCELLED") {
        updated++;
         if (dryRun) willCancel++;
        results.push({ externalRef, status: "CANCELLED", willStatus: dryRun ? "WILL_CANCEL" : null });
        continue;
      }
      unchanged++;
      if (dryRun) willUnchanged++;
      results.push({
        externalRef,
        status: "UNCHANGED",
        weeklyShiftPlanId: r.weeklyShiftPlanId,
        employeeId: r.employeeId,
        weekStartDate: r.weekStartIso,
        weekStartDateUtc: r.weekStartUtc,
        willStatus: dryRun ? "WILL_UNCHANGED" : null,
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        failed++;
        const err = { code: "UNIQUE_CONFLICT", message: "unique constraint violation", details: { externalRef } };
        results.push({ externalRef, status: "FAILED", error: err });
        errors.push({ externalRef, ...err });
        continue;
      }
      failed++;
      const err = { code: "INTERNAL_ERROR", message: "unexpected error", details: { externalRef } };
      results.push({ externalRef, status: "FAILED", error: err });
      errors.push({ externalRef, ...err });
    }
  }

  const total = plans.length;
  const status: IntegrationLogStatus =
    failed === 0 ? IntegrationLogStatus.SUCCESS : failed === total ? IntegrationLogStatus.FAILED : IntegrationLogStatus.PARTIAL;

  // Use a single processedAt timestamp for both finalize and webhook payload.
  const processedAt = new Date();

  // S10: optional callback (never in dryRun)
  let callbackMeta: any = null;
  const callback = input.callback ?? null;
  if (!dryRun && callback?.url) {
    const mode = (callback.mode ?? "ON_DONE") as "ON_SUCCESS" | "ON_DONE";
    const shouldSend = mode === "ON_DONE" || (mode === "ON_SUCCESS" && status === IntegrationLogStatus.SUCCESS);
    if (shouldSend) {
      const result = await sendIntegrationCallback({
        callback,
        payload: {
          requestId: ctx.requestId,
          endpoint: ctx.endpoint,
          sourceSystem,
          batchRef: input.batchRef ?? null,
          status,
          summary: { total, created, updated, unchanged, failed },
          processedAt: processedAt.toISOString(),
          dryRun: false,
        },
      });
      callbackMeta = summarizeCallbackForMeta(callback, result);
    }
  }

  if (!dryRun) {
    await finalizeIntegrationLogRepo({
      requestId: ctx.requestId,
      processedAt,
      totalCount: total,
      createdCount: created,
      updatedCount: updated,
      unchangedCount: unchanged,
      failedCount: failed,
      status,
      errors: errors.length ? errors : undefined,
      payloadMetaPatch: callbackMeta ? { callback: callbackMeta } : undefined,
    });
  }

  return {
    ok: true as const,
    status: 200,
    body: {
      requestId: ctx.requestId,
      sourceSystem,
      batchRef: input.batchRef ?? null,
      dryRun,
      dryRunSummary: dryRun ? { willCreate, willUpdate, willUnchanged, willCancel, willFailed: failed } : null,
      results,
      errors: errors.length ? errors : [],
    },
  };
}
