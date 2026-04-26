import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { listResolvedPayrollCodeMappingProfiles } from "@/src/services/puantaj/payrollCodeMappingResolver.service";
import { createPayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingDb.service";
import {
  requirePayrollMappingWriteSession,
  resolvePayrollMappingActorUserId,
} from "@/app/api/puantaj/payroll-mapping/_auth";
import { logPayrollMappingProfileCreated } from "@/src/services/puantaj/audit.service";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = await getActiveCompanyId();
  const { company } = await getCompanyBundle();
  const items = await listResolvedPayrollCodeMappingProfiles(companyId);

  const defaultProfile = items.find((x) => x.isDefault) ?? null;
  const activeCount = items.filter((x) => x.isActive !== false).length;
  const sourceSummary = {
    dbCount: items.filter((x) => x.source === "DB").length,
    fileCount: items.filter((x) => x.source === "FILE").length,
  };

  return NextResponse.json({
    ok: true,
    meta: {
      company: {
        id: companyId,
        name: company?.name ?? "",
      },
      summary: {
        totalProfiles: items.length,
        activeProfiles: activeCount,
        defaultProfileCode: defaultProfile?.code ?? null,
        sourceSummary,
      },
    },
    items: items.map((profile) => ({
      code: profile.code,
      name: profile.name,
      source: profile.source,
      isDefault: !!profile.isDefault,
      isActive: profile.isActive !== false,
      itemCount: profile.items.length,
      units: Array.from(new Set(profile.items.map((x) => x.unit))),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const companyId = await getActiveCompanyId();
    const actorUserId = await resolvePayrollMappingActorUserId(auth.session);

    const profile = await createPayrollCodeMappingProfile({
      companyId,
      code: String(body?.code ?? ""),
      name: String(body?.name ?? ""),
      isDefault: !!body?.isDefault,
      isActive: body?.isActive == null ? true : !!body.isActive,
    });

    await logPayrollMappingProfileCreated({
      companyId,
      actorUserId,
      profileCode: profile.code,
      name: profile.name,
      isDefault: profile.isDefault,
      isActive: profile.isActive,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "PROFILE_CREATE_FAILED",
      },
      { status: 400 }
    );
  }
}