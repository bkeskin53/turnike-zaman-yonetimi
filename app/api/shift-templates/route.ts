import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listShiftTemplates, listAllShiftTemplates, createShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";

export async function GET(req: NextRequest) {
   try {
     await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
     const companyId = await getActiveCompanyId();
     const includeInactive =
       String(req.nextUrl.searchParams.get("includeInactive") ?? "").trim() === "1";

     const items = includeInactive
       ? await listAllShiftTemplates(companyId)
       : await listShiftTemplates(companyId);

     return NextResponse.json({ items });
   } catch (e) {
     const auth = authErrorResponse(e);
     if (auth) return auth;
     console.error("[shift-templates] GET unexpected error", e);
     return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
   }
 }

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const companyId = await getActiveCompanyId();
    const body: any = await req.json().catch(() => ({}));

    const startTime = String(body?.startTime ?? "");
    const endTime = String(body?.endTime ?? "");
    const shiftCode = body?.shiftCode ? String(body.shiftCode) : undefined;
    const created = await createShiftTemplateForCompany(companyId, { startTime, endTime, shiftCode });
    return NextResponse.json({ item: created });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_ALREADY_EXISTS" }, { status: 409 });
    }
    return authErrorResponse(e);
  }
}