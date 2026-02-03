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
  input: { startTime: string; endTime: string }
) {
  const sig = buildShiftSignature(input.startTime, input.endTime);
  return createShiftTemplate({
    companyId,
    signature: sig.signature,
    startTime: sig.startTime,
    endTime: sig.endTime,
    spansMidnight: sig.spansMidnight,
  });
}

export async function updateShiftTemplateForCompany(
  companyId: string,
  id: string,
  input: { startTime: string; endTime: string }
) {
  const sig = buildShiftSignature(input.startTime, input.endTime);
 return updateShiftTemplate({
    companyId,
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