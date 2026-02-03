import crypto from "crypto";
import { Prisma, IntegrationLogStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  createIntegrationLogRepo,
  finalizeIntegrationLogRepo,
  findEmployeeLinkRepo,
  upsertEmployeeLinkRepo,
} from "@/src/repositories/integration.repo";
import {
  sendIntegrationCallback,
  summarizeCallbackForMeta,
  type IntegrationCallbackConfig,
} from "@/src/services/integrationWebhook.service";

type UpsertEmployeeInput = {
  externalRef: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  isActive?: boolean;
  cardNo?: string | null;
  deviceUserId?: string | null;
};

type UpsertBatchInput = {
  sourceSystem: string;
  batchRef?: string | null;
  employees: UpsertEmployeeInput[];
  callback?: IntegrationCallbackConfig | null;
};

export type IntegrationEmployeeUpsertResult =
  | { externalRef: string; status: "CREATED" | "UPDATED" | "UNCHANGED"; employeeId: string; employeeCode: string }
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

export async function integrationUpsertEmployees(input: UpsertBatchInput, ctx: {
  requestId: string;
  endpoint: string;
  ip: string | null;
  apiKeyHash: string;
  dryRun?: boolean;
}) {
  const companyId = await getActiveCompanyId();
  const dryRun = !!ctx.dryRun;

  let willCreate = 0;
  let willUpdate = 0;
  let willUnchanged = 0;

  const sourceSystem = normStr(input.sourceSystem);
  if (!sourceSystem) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "sourceSystem is required" } },
    };
  }

  const employees = Array.isArray(input.employees) ? input.employees : [];
  if (employees.length < 1) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "employees must be a non-empty array" } },
    };
  }

  const maxBatch = Number(process.env.INTEGRATION_MAX_BATCH_SIZE ?? "500");
  const maxBatchSafe = Number.isFinite(maxBatch) && maxBatch > 0 ? Math.trunc(maxBatch) : 500;
  if (employees.length > maxBatchSafe) {
    return {
      ok: false as const,
      status: 413,
      body: {
        requestId: ctx.requestId,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: `employees batch size exceeds limit (${maxBatchSafe})`,
        },
      },
    };
  }

  // In dryRun: do not create IntegrationLog (no persistence)
  if (!dryRun) {
    await createIntegrationLogRepo({
      companyId,
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      sourceSystem,
      batchRef: input.batchRef ?? null,
      ip: ctx.ip,
      apiKeyHash: ctx.apiKeyHash,
      payloadMeta: { count: employees.length },
    });
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const results: IntegrationEmployeeUpsertResult[] = [];
  const errors: any[] = [];

  for (const raw of employees) {
    const externalRef = normStr((raw as any)?.externalRef);
    const employeeCode = normStr((raw as any)?.employeeCode);
    const firstName = normStr((raw as any)?.firstName);
    const lastName = normStr((raw as any)?.lastName);

    // Required validation
    if (!externalRef || !employeeCode || !firstName || !lastName) {
      failed++;
      const err = {
        externalRef: externalRef || "(missing)",
        code: "VALIDATION_ERROR",
        message: "externalRef, employeeCode, firstName, lastName are required",
      };
      results.push({ externalRef: externalRef || "(missing)", status: "FAILED", error: { code: err.code, message: err.message } });
      errors.push(err);
      continue;
    }

    // Optional fields: support explicit null/empty to clear if key present
    const email = hasOwn(raw, "email") ? (raw.email ? String(raw.email).trim() : null) : undefined;
    const isActive = hasOwn(raw, "isActive") ? (raw.isActive === false ? false : true) : undefined;
    const cardNo = hasOwn(raw, "cardNo") ? (raw.cardNo ? String(raw.cardNo).trim() : null) : undefined;
    const deviceUserId = hasOwn(raw, "deviceUserId") ? (raw.deviceUserId ? String(raw.deviceUserId).trim() : null) : undefined;

    // For unchanged detection (only fields provided)
    const payloadHash = stableHash({
      externalRef,
      employeeCode,
      firstName,
      lastName,
      ...(hasOwn(raw, "email") ? { email } : {}),
      ...(hasOwn(raw, "isActive") ? { isActive } : {}),
      ...(hasOwn(raw, "cardNo") ? { cardNo } : {}),
      ...(hasOwn(raw, "deviceUserId") ? { deviceUserId } : {}),
    });

    try {
      const r = await prisma.$transaction(async (tx) => {
        // 1) Determine employee target
        const link = await tx.integrationEmployeeLink.findFirst({
          where: { companyId, sourceSystem, externalRef },
        });

        let employee = null as any;
        let mode: "CREATE" | "UPDATE" = "UPDATE";

        if (link?.employeeId) {
          employee = await tx.employee.findFirst({ where: { id: link.employeeId, companyId } });
          if (!employee) {
            // Link corrupted: treat as no link
            employee = null;
          }
        }

        if (!employee) {
          // Try match by employeeCode to avoid duplicates on first integration sync
          const existingByCode = await tx.employee.findFirst({ where: { companyId, employeeCode } });
          if (existingByCode) {
            employee = existingByCode;
            mode = "UPDATE";
          } else {
            mode = "CREATE";
            if (dryRun) {
              // simulate create
              employee = { id: "__DRY__", employeeCode };
            } else {
              employee = await tx.employee.create({
              data: {
                companyId,
                employeeCode,
                firstName,
                lastName,
                email: email ?? null,
                isActive: isActive ?? true,
                ...(cardNo !== undefined ? { cardNo } : {}),
                ...(deviceUserId !== undefined ? { deviceUserId } : {}),
              },
              });
            }
          }
        }

        // 2) Conflict checks (only when provided)
        if (cardNo !== undefined && cardNo) {
          const conflict = await tx.employee.findFirst({
            where: { companyId, cardNo, NOT: { id: employee.id } },
          });
          if (conflict) {
            return {
              ok: false as const,
              error: { code: "CARD_CONFLICT", message: "cardNo başka bir çalışana ait", details: { cardNo } },
            };
          }
        }
        if (deviceUserId !== undefined && deviceUserId) {
          const conflict = await tx.employee.findFirst({
            where: { companyId, deviceUserId, NOT: { id: employee.id } },
          });
          if (conflict) {
            return {
              ok: false as const,
              error: { code: "DEVICE_USER_ID_CONFLICT", message: "deviceUserId başka bir çalışana ait", details: { deviceUserId } },
            };
          }
        }

        // 3) Apply update (if not created)
        if (mode === "UPDATE") {
          const data: any = {
            employeeCode,
            firstName,
            lastName,
          };
          if (email !== undefined) data.email = email;
          if (isActive !== undefined) data.isActive = isActive;
          if (cardNo !== undefined) data.cardNo = cardNo;
          if (deviceUserId !== undefined) data.deviceUserId = deviceUserId;

          // Quick unchanged detection: if link hash matches AND employee fields equal
          const existingLink = await tx.integrationEmployeeLink.findFirst({
            where: { companyId, sourceSystem, externalRef },
          });
          const likelyUnchanged = existingLink?.lastPayloadHash && existingLink.lastPayloadHash === payloadHash;

          if (!likelyUnchanged) {
            if (!dryRun && employee.id !== "__DRY__") {
              employee = await tx.employee.update({
                where: { id: employee.id, companyId },
                data,
              });
            }
          }
        }

        // 4) Upsert link + last seen
        if (!dryRun && employee.id !== "__DRY__") {
          await tx.integrationEmployeeLink.upsert({
            where: {
              companyId_sourceSystem_externalRef: { companyId, sourceSystem, externalRef },
            },
            create: {
              companyId,
              sourceSystem,
              externalRef,
              employeeId: employee.id,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
            update: {
              employeeId: employee.id,
              lastSeenAt: new Date(),
              lastPayloadHash: payloadHash,
            },
          });
        }

        return {
          ok: true as const,
          mode,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          unchanged: mode === "UPDATE" ? false : false,
          // If we did not update due to hash match, treat as unchanged
          unchangedByHash: mode === "UPDATE"
            ? !!(await tx.integrationEmployeeLink.findFirst({
                where: { companyId, sourceSystem, externalRef, lastPayloadHash: payloadHash },
              }))
            : false,
          dryRun,
        };
      });

      if (!r.ok) {
        failed++;
        results.push({ externalRef, status: "FAILED", error: r.error });
        errors.push({ externalRef, ...r.error });
        continue;
      }

      if (r.mode === "CREATE") {
        created++;
        if (dryRun) willCreate++;
        results.push({ externalRef, status: dryRun ? "UPDATED" : "CREATED", employeeId: r.employeeId, employeeCode: r.employeeCode });
        continue;
      }

      if (r.unchangedByHash) {
        unchanged++;
        if (dryRun) willUnchanged++;
        results.push({ externalRef, status: "UNCHANGED", employeeId: r.employeeId, employeeCode: r.employeeCode });
      } else {
        updated++;
        if (dryRun) willUpdate++;
        results.push({ externalRef, status: "UPDATED", employeeId: r.employeeId, employeeCode: r.employeeCode });
      }
    } catch (e: any) {
      // Prisma unique errors, map to record-level FAILED
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
      continue;
    }
  }

  const total = employees.length;
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
      summary: { total, created, updated, unchanged, failed },
      dryRunSummary: dryRun ? { willCreate, willUpdate, willUnchanged, willFailed: failed } : null,
      results,
      errors: errors.length ? errors : [],
    },
  };
}
