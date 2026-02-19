import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import {
  listLeavesForEmployee,
  createLeaveForEmployee,
  LeaveOverlapError,
  LeaveInvalidRangeError,
  EmploymentNotEmployedError,
} from "@/src/services/leave.service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
  const { id } = await params;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const leaves = await listLeavesForEmployee(id, from, to);
  return NextResponse.json({ items: leaves });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
  const { id } = await params;

  const body = await req.json();
  try {
    await createLeaveForEmployee({ employeeId: id, ...body });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof EmploymentNotEmployedError) {
      return NextResponse.json(
        { error: e.code, message: e.message, meta: e.meta ?? null },
        { status: 400 }
      );
    }
    if (e instanceof LeaveInvalidRangeError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 400 }
      );
    }
    if (e instanceof LeaveOverlapError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 409 }
      );
    }
    throw e;
  }
}
