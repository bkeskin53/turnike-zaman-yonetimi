import { EventDirection } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { createRawEvent, listRawEvents } from "@/src/repositories/rawEvent.repo";
import { prisma } from "@/src/repositories/prisma";

export async function addManualEvent(input: {
  employeeId: string;
  occurredAt: string; // ISO
  direction: "IN" | "OUT";
}) {
  const companyId = await getActiveCompanyId();

  const employeeId = String(input.employeeId ?? "").trim();
  const direction =
    input.direction === "IN"
      ? EventDirection.IN
      : input.direction === "OUT"
      ? EventDirection.OUT
      : null;

  const occurredAt = new Date(String(input.occurredAt ?? ""));

  if (!employeeId || !direction || Number.isNaN(occurredAt.getTime())) {
    throw new Error("VALIDATION_ERROR");
  }

  // ✅ employee var mı ve bu company'ye mi ait?
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });

  if (!emp) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  return createRawEvent(companyId, { employeeId, direction, occurredAt });
}

export async function getEvents(filter: {
  employeeId?: string;
  date?: string;
  doorId?: string;
  deviceId?: string;
}) {
  const companyId = await getActiveCompanyId();
  const items = await listRawEvents(companyId, filter);
  return { items };
}
