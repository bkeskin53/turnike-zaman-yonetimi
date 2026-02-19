import type { ShiftSignature } from "@/src/services/shiftPlan.service";
import { buildShiftSignature } from "@/src/services/shiftPlan.service";
import {
  listShiftTemplates as listShiftTemplatesRepo,
  listAllShiftTemplates as listAllShiftTemplatesRepo,
  createShiftTemplate,
  updateShiftTemplate,
  deactivateShiftTemplate,
  activateShiftTemplate,
  findShiftTemplateById,
  findShiftTemplateBySignature,
} from "@/src/repositories/shiftTemplate.repo";

export async function getShiftTemplateById(companyId: string, id: string) {
  return findShiftTemplateById(companyId, id);
}

export async function findOrCreateShiftTemplate(companyId: string, sig: ShiftSignature) {
  const existing = await findShiftTemplateBySignature(companyId, sig.signature);
  if (existing) return existing;
  return createShiftTemplate({
    companyId,
    shiftCode: sig.signature,
    signature: sig.signature,
    startTime: sig.startTime,
    endTime: sig.endTime,
    spansMidnight: sig.spansMidnight,
  });
}

export async function listShiftTemplates(companyId: string) {
  return listShiftTemplatesRepo(companyId);
}

export async function listAllShiftTemplates(companyId: string) {
  return listAllShiftTemplatesRepo(companyId);
}

export async function createShiftTemplateForCompany(
  companyId: string,
  input: { startTime: string; endTime: string; shiftCode?: string }
) {
  const sig = buildShiftSignature(input.startTime, input.endTime);
  const shiftCode = typeof input.shiftCode === "string" && input.shiftCode.trim() ? input.shiftCode.trim() : sig.signature;
  return createShiftTemplate({
    companyId,
    shiftCode,
    signature: sig.signature,
    startTime: sig.startTime,
    endTime: sig.endTime,
    spansMidnight: sig.spansMidnight,
  });
}

export async function updateShiftTemplateForCompany(
  companyId: string,
  id: string,
  input: { startTime: string; endTime: string; shiftCode?: string }
) {
  const sig = buildShiftSignature(input.startTime, input.endTime);
 // IMPORTANT (B-model): shiftCode is a stable identity. Do not change it unless explicitly provided.
  const existing = await getShiftTemplateById(companyId, id);
  if (!existing) throw new Error("SHIFT_TEMPLATE_NOT_FOUND");

  const shiftCode =
    typeof input.shiftCode === "string" && input.shiftCode.trim()
      ? input.shiftCode.trim()
      : (existing as any).shiftCode;

  return updateShiftTemplate({
    companyId,
    shiftCode,
    id,
    signature: sig.signature,
    startTime: sig.startTime,
    endTime: sig.endTime,
    spansMidnight: sig.spansMidnight,
  });
}

export async function deactivateShiftTemplateForCompany(companyId: string, id: string) {
  return deactivateShiftTemplate(companyId, id);
}

export async function activateShiftTemplateForCompany(companyId: string, id: string) {
  return activateShiftTemplate(companyId, id);
}