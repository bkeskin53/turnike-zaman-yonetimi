import crypto from "crypto";
import { DateTime } from "luxon";
import { Prisma, IntegrationLogStatus, LeaveType } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  createIntegrationLogRepo,
  finalizeIntegrationLogRepo,
} from "@/src/repositories/integration.repo";
import { findLeaveOverlap, findLeaveOverlapExcludingId, updateEmployeeLeave, createEmployeeLeave, deleteEmployeeLeave } from "@/src/repositories/leave.repo";
import {
  sendIntegrationCallback,
  summarizeCallbackForMeta,
  type IntegrationCallbackConfig,
} from "@/src/services/integrationWebhook.service";
import { assertEmployeeEmployedForRange } from "@/src/services/employmentGuard.service";

type UpsertLeaveInput = {
  externalRef: string;
  employeeExternalRef?: string | null;
  employeeCode?: string | null;
  dateFrom: string;
  dateTo: string;
  type: string;
  note?: string | null;
  isCancelled?: boolean;
};

type UpsertBatchInput = {
  sourceSystem: string;
  batchRef?: string | null;
  leaves: UpsertLeaveInput[];
  callback?: IntegrationCallbackConfig | null;
};

type LeaveWillStatus = "WILL_CREATE" | "WILL_UPDATE" | "WILL_UNCHANGED" | "WILL_CANCEL" | null;

export type IntegrationLeaveUpsertResult =
  | {
      externalRef: string;
      status: "CREATED" | "UPDATED" | "UNCHANGED" | "CANCELLED";
      leaveId?: string;
      employeeId?: string;
      normalizedFromUtc?: Date;
      normalizedToUtc?: Date;
      willStatus?: LeaveWillStatus;
    }
  | {
      externalRef: string;
      status: "FAILED";
      error: { code: string; message: string; details?: any };
      willStatus?: null;
    };

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

function isValidLeaveType(t: string) {
  const u = String(t ?? "").trim().toUpperCase();
  return u === "ANNUAL" || u === "SICK" || u === "EXCUSED" || u === "UNPAID";
}

function parseDayRangeToUtc(dateFrom: string, dateTo: string, tz: string) {
  const fromUtc = DateTime.fromISO(dateFrom, { zone: tz }).startOf("day").toUTC().toJSDate();
  const toUtc = DateTime.fromISO(dateTo, { zone: tz }).endOf("day").toUTC().toJSDate();
  return { fromUtc, toUtc };
}

export async function integrationUpsertLeaves(input: UpsertBatchInput, ctx: {
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

  const leaves = Array.isArray(input.leaves) ? input.leaves : [];
  if (leaves.length < 1) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "leaves must be a non-empty array" } },
    };
  }

  const maxBatch = Number(process.env.INTEGRATION_MAX_BATCH_SIZE ?? "500");
  const maxBatchSafe = Number.isFinite(maxBatch) && maxBatch > 0 ? Math.trunc(maxBatch) : 500;
  if (leaves.length > maxBatchSafe) {
    return {
      ok: false as const,
      status: 413,
      body: {
        requestId: ctx.requestId,
        error: { code: "PAYLOAD_TOO_LARGE", message: `leaves batch size exceeds limit (${maxBatchSafe})` },
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
      payloadMeta: { count: leaves.length },
    });
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  // DryRun friendly rollup (kept in addition to classic summary)
  let willCreate = 0;
  let willUpdate = 0;
  let willUnchanged = 0;
  let willCancel = 0;
  const results: IntegrationLeaveUpsertResult[] = [];
  const errors: any[] = [];

  for (const raw of leaves) {
    const externalRef = normStr((raw as any)?.externalRef);
    const employeeExternalRef = hasOwn(raw, "employeeExternalRef") ? normStr((raw as any)?.employeeExternalRef) : "";
    const employeeCode = hasOwn(raw, "employeeCode") ? normStr((raw as any)?.employeeCode) : "";
    const dateFrom = normStr((raw as any)?.dateFrom);
    const dateTo = normStr((raw as any)?.dateTo);
    const type = normStr((raw as any)?.type).toUpperCase();
    const note = hasOwn(raw, "note") ? (raw.note ? String(raw.note).trim() : null) : undefined;
    const isCancelled = hasOwn(raw, "isCancelled") ? !!raw.isCancelled : false;

    if (!externalRef) {
      failed++;
      const err = { externalRef: "(missing)", code: "VALIDATION_ERROR", message: "externalRef is required" };
      results.push({ externalRef: "(missing)", status: "FAILED", error: { code: err.code, message: err.message } });
      errors.push(err);
      continue;
    }

    // If cancel: we only need externalRef; rest optional.
    if (!isCancelled) {
      if (!dateFrom || !dateTo || !isValidLeaveType(type) || (!employeeExternalRef && !employeeCode)) {
        failed++;
        const err = {
          externalRef,
          code: "VALIDATION_ERROR",
          message: "employeeExternalRef (or employeeCode), dateFrom, dateTo, and valid type are required",
        };
        results.push({ externalRef, status: "FAILED", error: { code: err.code, message: err.message } });
        errors.push(err);
        continue;
      }
    }

    const payloadHash = stableHash({
      externalRef,
      ...(employeeExternalRef ? { employeeExternalRef } : {}),
      ...(employeeCode ? { employeeCode } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(type ? { type } : {}),
      ...(note !== undefined ? { note } : {}),
      isCancelled,
    });

    try {
      const r = await prisma.$transaction(async (tx) => {
        // Find existing link
        const link = await tx.integrationLeaveLink.findFirst({
          where: { companyId, sourceSystem, externalRef },
        });

        // Cancel flow
        if (isCancelled) {
          if (!link) {
            return { ok: true as const, action: "UNCHANGED" as const };
          }
          // delete leave (will cascade link if FK cascade doesn't delete link; we delete explicitly)
          if (!dryRun) {
            await tx.integrationLeaveLink.delete({
              where: {
                companyId_sourceSystem_externalRef: { companyId, sourceSystem, externalRef },
              },
            });
            await tx.employeeLeave.delete({ where: { id: link.leaveId } });
          }
          return { ok: true as const, action: "CANCELLED" as const };
        }

        // Resolve employeeId
        let employeeId: string | null = null;
        if (employeeExternalRef) {
          const empLink = await tx.integrationEmployeeLink.findFirst({
            where: { companyId, sourceSystem, externalRef: employeeExternalRef },
          });
          if (empLink?.employeeId) employeeId = empLink.employeeId;
        }
        if (!employeeId && employeeCode) {
          const emp = await tx.employee.findFirst({ where: { companyId, employeeCode } });
          if (emp) employeeId = emp.id;
        }
        if (!employeeId) {
          return {
            ok: false as const,
            error: { code: "EMPLOYEE_NOT_FOUND", message: "employee not found for leave", details: { employeeExternalRef, employeeCode } },
          };
        }

        const { fromUtc, toUtc } = parseDayRangeToUtc(dateFrom, dateTo, tz);
        if (fromUtc.getTime() > toUtc.getTime()) {
          return { ok: false as const, error: { code: "LEAVE_INVALID_RANGE", message: "dateFrom cannot be after dateTo" } };
        }
        
        // ✅ Eksik-3: integration leave de employment validity içinde olmalı (strict)
        await assertEmployeeEmployedForRange({
          companyId,
          employeeId,
          fromDayKey: dateFrom,
          toDayKey: dateTo,
          db: tx,
        });

        // If existing and hash matches -> unchanged
        if (link?.lastPayloadHash && link.lastPayloadHash === payloadHash) {
          return { ok: true as const, action: "UNCHANGED" as const, leaveId: link.leaveId, employeeId };
        }

        if (!link) {
          // overlap check
          const overlap = await tx.employeeLeave.findFirst({
            where: { employeeId, dateFrom: { lte: toUtc }, dateTo: { gte: fromUtc } },
            orderBy: { dateFrom: "asc" },
          });
          if (overlap) {
            return { ok: false as const, error: { code: "LEAVE_OVERLAP", message: "Bu tarihlerde zaten izin kaydı var." } };
          }

          if (dryRun) {
            return { ok: true as const, action: "CREATED" as const, leaveId: "__DRY__", employeeId, fromUtc, toUtc };
          }

          const leave = await tx.employeeLeave.create({
            data: {
              companyId,
              employeeId,
              dateFrom: fromUtc,
              dateTo: toUtc,
              type: type as LeaveType,
              note: note ?? null,
            },
          });

          await tx.integrationLeaveLink.create({
            data: {
              companyId,
              sourceSystem,
              externalRef,
              employeeId,
              leaveId: leave.id,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
          });

          return { ok: true as const, action: "CREATED" as const, leaveId: leave.id, employeeId, fromUtc, toUtc };
        }

        // Update existing leave
        const leaveId = link.leaveId;
        const overlap = await tx.employeeLeave.findFirst({
          where: {
            employeeId,
            NOT: { id: leaveId },
            dateFrom: { lte: toUtc },
            dateTo: { gte: fromUtc },
          },
          orderBy: { dateFrom: "asc" },
        });
        if (overlap) {
          return { ok: false as const, error: { code: "LEAVE_OVERLAP", message: "Bu tarihlerde zaten izin kaydı var." } };
        }

        if (!dryRun) {
          await tx.employeeLeave.update({
            where: { id: leaveId },
            data: {
              employeeId,
              companyId,
              dateFrom: fromUtc,
              dateTo: toUtc,
              type: type as LeaveType,
              note: note ?? null,
            },
          });

          await tx.integrationLeaveLink.update({
            where: {
              companyId_sourceSystem_externalRef: { companyId, sourceSystem, externalRef },
            },
            data: {
              employeeId,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
          });
        }

        return { ok: true as const, action: "UPDATED" as const, leaveId, employeeId, fromUtc, toUtc };
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
          leaveId: r.leaveId,
          employeeId: r.employeeId,
          normalizedFromUtc: r.fromUtc,
          normalizedToUtc: r.toUtc,
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
          leaveId: r.leaveId,
          employeeId: r.employeeId,
          normalizedFromUtc: r.fromUtc,
          normalizedToUtc: r.toUtc,
        willStatus: dryRun ? "WILL_UPDATE" : null,
        });
        continue;
      }
      if (r.action === "CANCELLED") {
        // Treat cancelled as updated for summary? No: separate status but counts in updatedCount is OK.
        updated++;
        if (dryRun) willCancel++;
        results.push({ externalRef, status: "CANCELLED", willStatus: dryRun ? "WILL_CANCEL" : null });
        continue;
      }

      unchanged++;
      if (dryRun) willUnchanged++;
      results.push({ externalRef, status: "UNCHANGED", leaveId: r.leaveId, employeeId: r.employeeId, willStatus: dryRun ? "WILL_UNCHANGED" : null });
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

  const total = leaves.length;
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
      summary: { total, created, updated, unchanged, failed },
      dryRunSummary: dryRun ? { willCreate, willUpdate, willUnchanged, willCancel, willFailed: failed } : null,
      results,
      errors: errors.length ? errors : [],
    },
  };
}
