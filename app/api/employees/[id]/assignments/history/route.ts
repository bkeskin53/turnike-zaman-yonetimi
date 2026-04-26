import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { dayKeyToday } from "@/src/utils/dayKey";
import {
  normalizeEmployeeAssignmentEditDraft,
  toEmployeeAssignmentEditPayload,
  validateEmployeeAssignmentEditDraft,
} from "@/src/features/employees/assignmentEditForm";
import {
  createEmployeeAssignmentsHistoryRecord,
  deleteEmployeeAssignmentsHistoryRecord,
  isEmployeeContextHistoryMutationError,
  listEmployeeAssignmentsHistory,
  updateEmployeeAssignmentsHistoryRecord,
} from "@/src/services/employees/employeeContextHistory.service";
import { isEmployeeOrgAssignmentMutationError } from "@/src/services/employeeOrgAssignmentMutation.service";

function readRecordId(body: Record<string, unknown>): string | null {
  const value = String(body.recordId ?? "").trim();
  return value || null;
}

async function readBodyObject(req: Request): Promise<Record<string, unknown> | null> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ROLE_SETS.READ_ALL);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const timezone = bundle.policy?.timezone || "Europe/Istanbul";
    const todayDayKey = dayKeyToday(timezone);

    const item = await listEmployeeAssignmentsHistory({
      companyId,
      employeeId: id,
      todayDayKey,
      timezone,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeContextHistoryMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments/history][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(ROLE_SETS.OPS_WRITE);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const body = await readBodyObject(req);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    const draft = normalizeEmployeeAssignmentEditDraft(body);
    const validationCode = validateEmployeeAssignmentEditDraft(draft);
    if (validationCode) return NextResponse.json({ error: validationCode }, { status: 400 });

    const payload = toEmployeeAssignmentEditPayload(draft);
    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const timezone = bundle.policy?.timezone || "Europe/Istanbul";
    const todayDayKey = dayKeyToday(timezone);

    const item = await createEmployeeAssignmentsHistoryRecord({
      companyId,
      employeeId: id,
      actorUserId: session.userId,
      todayDayKey,
      payload,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeContextHistoryMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    if (isEmployeeOrgAssignmentMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments/history][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(ROLE_SETS.OPS_WRITE);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const body = await readBodyObject(req);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    const recordId = readRecordId(body);
    if (!recordId) return NextResponse.json({ error: "RECORD_ID_REQUIRED" }, { status: 400 });

    const draft = normalizeEmployeeAssignmentEditDraft(body);
    const validationCode = validateEmployeeAssignmentEditDraft(draft);
    if (validationCode) return NextResponse.json({ error: validationCode }, { status: 400 });

    const payload = toEmployeeAssignmentEditPayload(draft);
    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const timezone = bundle.policy?.timezone || "Europe/Istanbul";
    const todayDayKey = dayKeyToday(timezone);

    const item = await updateEmployeeAssignmentsHistoryRecord({
      companyId,
      employeeId: id,
      recordId,
      actorUserId: session.userId,
      todayDayKey,
      payload,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeContextHistoryMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" || err.code === "RECORD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    if (isEmployeeOrgAssignmentMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments/history][PATCH] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(ROLE_SETS.OPS_WRITE);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const body = await readBodyObject(req);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    const recordId = readRecordId(body);
    if (!recordId) return NextResponse.json({ error: "RECORD_ID_REQUIRED" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const timezone = bundle.policy?.timezone || "Europe/Istanbul";
    const todayDayKey = dayKeyToday(timezone);

    const item = await deleteEmployeeAssignmentsHistoryRecord({
      companyId,
      employeeId: id,
      recordId,
      actorUserId: session.userId,
      todayDayKey,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeContextHistoryMutationError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" || err.code === "RECORD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments/history][DELETE] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
