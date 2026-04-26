import { NextResponse } from "next/server";
import { getActiveCompanyId } from "@/src/services/company.service";
import { setPayrollCodeMappingProfileActive } from "@/src/services/puantaj/payrollCodeMappingDb.service";
import {
  requirePayrollMappingWriteSession,
  resolvePayrollMappingActorUserId,
} from "@/app/api/puantaj/payroll-mapping/_auth";
import { logPayrollMappingProfileActiveChanged } from "@/src/services/puantaj/audit.service";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(req: Request, context: RouteContext) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const { code: rawCode } = await context.params;
    const companyId = await getActiveCompanyId();
    const actorUserId = await resolvePayrollMappingActorUserId(auth.session);

    const profile = await setPayrollCodeMappingProfileActive({
      companyId,
      code: String(rawCode ?? ""),
      isActive: !!body?.isActive,
    });

    await logPayrollMappingProfileActiveChanged({
      companyId,
      actorUserId,
      profileCode: profile.code,
      isActive: profile.isActive,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "PROFILE_SET_ACTIVE_FAILED",
      },
      { status: 400 }
    );
  }
}