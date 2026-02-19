import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createPattern, listPatterns } from "@/src/services/workSchedulePattern.service";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const data = await listPatterns();
    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body: any = await req.json().catch(() => ({}));
    const data = await createPattern({
      code: String(body?.code ?? ""),
      name: String(body?.name ?? ""),
      cycleLengthDays: Number(body?.cycleLengthDays ?? 0),
      referenceDayKey: String(body?.referenceDayKey ?? ""),
      dayShiftTemplateIds: Array.isArray(body?.dayShiftTemplateIds) ? body.dayShiftTemplateIds : [],
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}