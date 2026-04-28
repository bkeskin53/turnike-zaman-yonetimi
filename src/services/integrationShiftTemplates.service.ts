import crypto from "crypto";
import { Prisma, IntegrationLogStatus, RecomputeReason } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { createIntegrationLogRepo, finalizeIntegrationLogRepo } from "@/src/repositories/integration.repo";
import { buildShiftSignature } from "@/src/services/shiftPlan.service";
import {
  derivePlannedWorkMinutesFromShiftTimes,
  deriveShiftTemplateClock,
} from "@/src/domain/shiftTemplates/shiftTemplateClock";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  sendIntegrationCallback,
  summarizeCallbackForMeta,
  type IntegrationCallbackConfig,
} from "@/src/services/integrationWebhook.service";

type UpsertShiftTemplateInput = {
  // New canonical contract:
  //   shiftCode + plannedWorkHours + startTime
  //
  // Legacy contract is still supported:
  //   signature? + startTime + endTime
  //
  // signature opsiyonel: gönderilirse derived signature ile uyumlu olmalı (guard).
  shiftCode?: string | null;
  signature?: string | null;
  plannedWorkHours?: string | number | null;
  plannedWorkHoursText?: string | number | null;
  plannedWorkDecimalHours?: string | number | null;
  plannedWorkMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

type BatchInput = {
  sourceSystem: string;
  batchRef?: string | null;
  templates: UpsertShiftTemplateInput[];
  callback?: IntegrationCallbackConfig | null;
};

export type IntegrationShiftTemplateResult =
  | { signature: string; status: "CREATED" | "UPDATED" | "UNCHANGED"; shiftTemplateId: string; isActive: boolean }
  | { signature: string; status: "FAILED"; error: { code: string; message: string; details?: any } };

function stableHash(obj: any) {
  const s = JSON.stringify(obj);
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function normStr(v: any) {
  const s = String(v ?? "").trim();
  return s || "";
}

function firstNonBlank(...values: any[]) {
  for (const value of values) {
    if (value == null) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return undefined;
}

function integrationItemError(code: string, message: string, details?: any) {
  const err = new Error(message) as Error & { code: string; details?: any };
  err.code = code;
  err.details = details;
  return err;
}

function normalizeIntegrationShiftTemplate(raw: any) {
  const providedShiftCode = normStr(raw?.shiftCode);
  const providedSignature = normStr(raw?.signature);
  const startTimeRaw = normStr(raw?.startTime);
  const endTimeRaw = normStr(raw?.endTime);
  const plannedWorkHours = firstNonBlank(
    raw?.plannedWorkHours,
    raw?.plannedWorkHoursText,
    raw?.plannedWorkDecimalHours
  );
  const plannedWorkMinutesRaw = firstNonBlank(raw?.plannedWorkMinutes);
  const identityCode = providedShiftCode || providedSignature || undefined;

  if (plannedWorkHours !== undefined || plannedWorkMinutesRaw !== undefined) {
    const plannedWorkMinutes =
      plannedWorkMinutesRaw !== undefined ? Number(plannedWorkMinutesRaw) : undefined;

    const clock = deriveShiftTemplateClock({
      shiftCode: identityCode,
      plannedWorkHours,
      plannedWorkMinutes,
      startTime: startTimeRaw || null,
    });

    if (providedSignature && providedSignature !== clock.signature) {
      throw integrationItemError(
        "SIGNATURE_MISMATCH",
        "provided signature does not match derived signature from plannedWorkHours/startTime",
        {
          provided: providedSignature,
          derived: clock.signature,
          startTime: clock.startTime,
          endTime: clock.endTime,
          plannedWorkMinutes: clock.plannedWorkMinutes,
          plannedWorkHoursText: clock.plannedWorkHoursText,
        }
      );
    }

    return {
      shiftCode: providedShiftCode || providedSignature || clock.signature,
      signature: clock.signature,
      startTime: clock.startTime,
      endTime: clock.endTime,
      spansMidnight: clock.spansMidnight,
      plannedWorkMinutes: clock.plannedWorkMinutes,
      plannedWorkHoursText: clock.plannedWorkHoursText,
    };
  }

  if (!startTimeRaw || !endTimeRaw) {
    throw integrationItemError(
      "INVALID_TEMPLATE",
      "plannedWorkHours + startTime or legacy startTime + endTime is required",
      {
        shiftCode: providedShiftCode || null,
        signature: providedSignature || null,
        plannedWorkHours: plannedWorkHours ?? null,
        startTime: startTimeRaw,
        endTime: endTimeRaw,
      }
    );
  }

  const derived = buildShiftSignature(startTimeRaw, endTimeRaw);
  const plannedWorkMinutes = derivePlannedWorkMinutesFromShiftTimes(derived.startTime, derived.endTime);
  const clock = deriveShiftTemplateClock({
    shiftCode: identityCode,
    plannedWorkMinutes,
    startTime: derived.startTime,
  });

  if (providedSignature && providedSignature !== clock.signature) {
    throw integrationItemError(
      "SIGNATURE_MISMATCH",
      "provided signature does not match derived signature from startTime/endTime",
      {
        provided: providedSignature,
        derived: clock.signature,
        startTime: clock.startTime,
        endTime: clock.endTime,
      }
    );
  }

  return {
    shiftCode: providedShiftCode || providedSignature || clock.signature,
    signature: clock.signature,
    startTime: clock.startTime,
    endTime: clock.endTime,
    spansMidnight: clock.spansMidnight,
    plannedWorkMinutes: clock.plannedWorkMinutes,
    plannedWorkHoursText: clock.plannedWorkHoursText,
  };
}

export async function integrationUpsertShiftTemplates(
  input: BatchInput,
  ctx: {
    requestId: string;
    endpoint: string;
    ip: string | null;
    apiKeyHash: string;
    dryRun?: boolean;
  }
) {
  const companyId = await getActiveCompanyId();
  const dryRun = !!ctx.dryRun;

  let willCreate = 0;
  let willUpdate = 0;
  let willUnchanged = 0;

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  const sourceSystem = normStr(input.sourceSystem);
  if (!sourceSystem) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "sourceSystem is required" } },
    };
  }

  const templates = Array.isArray(input.templates) ? input.templates : [];
  if (templates.length < 1) {
    return {
      ok: false as const,
      status: 400,
      body: { requestId: ctx.requestId, error: { code: "INVALID_REQUEST", message: "templates must be a non-empty array" } },
    };
  }

  const maxBatch = Number(process.env.INTEGRATION_MAX_BATCH_SIZE ?? "500");
  if (!Number.isFinite(maxBatch) || maxBatch < 1) {
    return {
      ok: false as const,
      status: 500,
      body: { requestId: ctx.requestId, error: { code: "SERVER_MISCONFIG", message: "INTEGRATION_MAX_BATCH_SIZE invalid" } },
    };
  }
  if (templates.length > maxBatch) {
    return {
      ok: false as const,
      status: 413,
      body: { requestId: ctx.requestId, error: { code: "BATCH_TOO_LARGE", message: `templates length > ${maxBatch}` } },
    };
  }

  // Create log (unless dryRun)
  if (!dryRun) {
    await createIntegrationLogRepo({
      companyId,
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      sourceSystem,
      batchRef: input.batchRef ?? null,
      ip: ctx.ip ?? null,
      apiKeyHash: ctx.apiKeyHash,
      payloadMeta: {
        dryRun: false,
        total: templates.length,
        hash: stableHash({ sourceSystem, batchRef: input.batchRef ?? null, templates }),
      },
    });
  }

  const results: IntegrationShiftTemplateResult[] = [];
  const errors: any[] = [];

  for (const raw of templates) {
    let normalized: ReturnType<typeof normalizeIntegrationShiftTemplate>;
    try {
      normalized = normalizeIntegrationShiftTemplate(raw as any);
    } catch (e: any) {
      failed += 1;
      willUnchanged += 1; // dryRun summary not critical here; keep counts stable-ish
      const signature = normStr((raw as any)?.signature) || normStr((raw as any)?.shiftCode) || "—";
      const code =
        typeof e?.code === "string"
          ? e.code
          : typeof e?.message === "string" && e.message.startsWith("PLANNED_WORK_")
            ? "PLANNED_WORK_INVALID"
            : "INVALID_TEMPLATE";
      const err = {
        code,
        message: String(e?.message ?? "invalid shift template"),
        details: e?.details ?? {
          shiftCode: normStr((raw as any)?.shiftCode) || null,
          signature: normStr((raw as any)?.signature) || null,
        },
      };
      results.push({ signature, status: "FAILED", error: err });
      errors.push({ signature, ...err });
      continue;
    }

    const { shiftCode, signature, startTime, endTime, spansMidnight, plannedWorkMinutes } = normalized;

    // Find existing by stable identity and derived signature. If both point to
    // different records, the item is unsafe to apply.
    const matches = await prisma.shiftTemplate.findMany({
      where: {
        companyId,
        OR: [{ signature }, { shiftCode }],
      },
      select: {
        id: true,
        shiftCode: true,
        signature: true,
        startTime: true,
        endTime: true,
        spansMidnight: true,
        plannedWorkMinutes: true,
        isActive: true,
      },
      take: 2,
    });

    const existing = matches[0] ?? null;

    if (matches.length > 1 && matches.some((m) => m.id !== existing.id)) {
      failed += 1;
      const err = {
        code: "SHIFT_TEMPLATE_IDENTITY_CONFLICT",
        message: "shiftCode and signature match different shift templates",
        details: {
          shiftCode,
          signature,
          matchedIds: matches.map((m) => m.id),
        },
      };
      results.push({ signature, status: "FAILED", error: err });
      errors.push({ signature, ...err });
      continue;
    }

    if (!existing) {
      if (dryRun) {
        willCreate += 1;
        results.push({ signature, status: "CREATED", shiftTemplateId: "DRY_RUN", isActive: true });
        continue;
      }
      const createdTpl = await prisma.shiftTemplate.create({
        data: {
          companyId,
          signature,
          shiftCode,
          name: shiftCode,
          startTime,
          endTime,
          spansMidnight,
          plannedWorkMinutes,
          isActive: true,
        },
        select: { id: true, isActive: true },
      });
      created += 1;
      results.push({ signature, status: "CREATED", shiftTemplateId: createdTpl.id, isActive: createdTpl.isActive });
      continue;
    }

    // Exists: update if any changes or was inactive.
    const needsUpdate =
      existing.shiftCode !== shiftCode ||
      existing.signature !== signature ||
      existing.startTime !== startTime ||
      existing.endTime !== endTime ||
      existing.spansMidnight !== spansMidnight ||
      existing.plannedWorkMinutes !== plannedWorkMinutes ||
      existing.isActive !== true;

    if (!needsUpdate) {
      if (dryRun) willUnchanged += 1;
      unchanged += 1;
      results.push({ signature, status: "UNCHANGED", shiftTemplateId: existing.id, isActive: existing.isActive });
      continue;
    }

    if (dryRun) {
      willUpdate += 1;
      results.push({ signature, status: "UPDATED", shiftTemplateId: existing.id, isActive: true });
      continue;
    }

    const updatedTpl = await prisma.shiftTemplate.update({
      where: { id: existing.id },
      data: {
        shiftCode,
        signature,
        startTime,
        endTime,
        spansMidnight,
        plannedWorkMinutes,
        isActive: true, // CRITICAL: if was passive, auto-activate on integration upsert.
      },
      select: { id: true, isActive: true },
    });

    updated += 1;
    results.push({ signature, status: "UPDATED", shiftTemplateId: updatedTpl.id, isActive: updatedTpl.isActive });
  }

  const total = templates.length;
  const status: IntegrationLogStatus =
    failed === 0 ? IntegrationLogStatus.SUCCESS : failed === total ? IntegrationLogStatus.FAILED : IntegrationLogStatus.PARTIAL;

  const processedAt = new Date();

  if (!dryRun && (created > 0 || updated > 0)) {
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: null,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });
  }

  // S10 callback (never in dryRun)
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
