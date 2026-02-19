import crypto from "crypto";
import { Prisma, IntegrationLogStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { createIntegrationLogRepo, finalizeIntegrationLogRepo } from "@/src/repositories/integration.repo";
import { buildShiftSignature } from "@/src/services/shiftPlan.service";
import {
  sendIntegrationCallback,
  summarizeCallbackForMeta,
  type IntegrationCallbackConfig,
} from "@/src/services/integrationWebhook.service";

type UpsertShiftTemplateInput = {
  // signature opsiyonel: gönderilirse derived signature ile uyumlu olmalı (guard).
  signature?: string | null;
  startTime: string;
  endTime: string;
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
    const startTimeRaw = normStr((raw as any)?.startTime);
    const endTimeRaw = normStr((raw as any)?.endTime);

    if (!startTimeRaw || !endTimeRaw) {
      failed += 1;
      willUnchanged += 1; // dryRun summary not critical here; keep counts stable-ish
      const signature = normStr((raw as any)?.signature) || "—";
      const err = { code: "INVALID_TEMPLATE", message: "startTime and endTime are required", details: { startTime: startTimeRaw, endTime: endTimeRaw } };
      results.push({ signature, status: "FAILED", error: err });
      errors.push({ signature, ...err });
      continue;
    }

    const derived = buildShiftSignature(startTimeRaw, endTimeRaw);
    const signature = derived.signature;

    const providedSig = normStr((raw as any)?.signature);
    if (providedSig && providedSig !== signature) {
      failed += 1;
      const err = {
        code: "SIGNATURE_MISMATCH",
        message: "provided signature does not match derived signature from startTime/endTime",
        details: { provided: providedSig, derived: signature, startTime: derived.startTime, endTime: derived.endTime },
      };
      results.push({ signature, status: "FAILED", error: err });
      errors.push({ signature, ...err });
      continue;
    }

    // Find existing by unique key (companyId+signature), regardless of isActive.
    const existing = await prisma.shiftTemplate.findFirst({
      where: { companyId, signature },
      select: { id: true, startTime: true, endTime: true, spansMidnight: true, isActive: true },
    });

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
          shiftCode: signature,
          startTime: derived.startTime,
          endTime: derived.endTime,
          spansMidnight: derived.spansMidnight,
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
      existing.startTime !== derived.startTime ||
      existing.endTime !== derived.endTime ||
      existing.spansMidnight !== derived.spansMidnight ||
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
        startTime: derived.startTime,
        endTime: derived.endTime,
        spansMidnight: derived.spansMidnight,
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
