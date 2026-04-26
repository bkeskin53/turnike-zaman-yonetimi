import { NextResponse } from "next/server";
import { getActiveCompanyId } from "@/src/services/company.service";
import { setDefaultPayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingDb.service";
import {
  requirePayrollMappingWriteSession,
  resolvePayrollMappingActorUserId,
} from "@/app/api/puantaj/payroll-mapping/_auth";
import { logPayrollMappingProfileDefaultChanged } from "@/src/services/puantaj/audit.service";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { code: rawCode } = await context.params;
    const companyId = await getActiveCompanyId();
    const actorUserId = await resolvePayrollMappingActorUserId(auth.session);
    const profile = await setDefaultPayrollCodeMappingProfile({
      companyId,
      code: String(rawCode ?? ""),
    });

    await logPayrollMappingProfileDefaultChanged({
      companyId,
      actorUserId,
      profileCode: profile.code,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "PROFILE_SET_DEFAULT_FAILED",
      },
      { status: 400 }
    );
  }
}