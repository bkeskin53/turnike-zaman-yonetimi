import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { updateShiftTemplateForCompany, deactivateShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const body = await req.json().catch(() => ({}));
    const startTime = String(body?.startTime ?? "");
    const endTime = String(body?.endTime ?? "");
    const shiftCode = body?.shiftCode ? String(body.shiftCode) : undefined;
    const item = await updateShiftTemplateForCompany(companyId, id, { startTime, endTime, shiftCode });
    return NextResponse.json({ item });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_ALREADY_EXISTS" }, { status: 409 });
    }
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates/[id]] PUT unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    await deactivateShiftTemplateForCompany(companyId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates/[id]] DELETE unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}