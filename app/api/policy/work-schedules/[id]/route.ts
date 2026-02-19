import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { updatePattern } from "@/src/services/workSchedulePattern.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const body: any = await req.json().catch(() => ({}));
    const data = await updatePattern({
      id,
      ...(body?.code != null ? { code: String(body.code) } : {}),
      ...(body?.name != null ? { name: String(body.name) } : {}),
      ...(body?.cycleLengthDays != null ? { cycleLengthDays: Number(body.cycleLengthDays) } : {}),
      ...(body?.referenceDayKey != null ? { referenceDayKey: String(body.referenceDayKey) } : {}),
      ...(body?.dayShiftTemplateIds != null ? { dayShiftTemplateIds: body.dayShiftTemplateIds } : {}),
      ...(body?.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}