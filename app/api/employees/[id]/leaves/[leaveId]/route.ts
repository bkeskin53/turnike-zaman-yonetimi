import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { deleteLeave } from "@/src/services/leave.service";

/**
 * DELETE /api/employees/[id]/leaves/[leaveId]
 * Deletes a leave record for the given employee. Only ADMIN or HR may perform this action.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; leaveId: string }> }
) {
  await requireRole(["ADMIN", "HR"]);
  const { id, leaveId } = await params;

  await deleteLeave(id, leaveId);
  return NextResponse.json({ ok: true });
}
