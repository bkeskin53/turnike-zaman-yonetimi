import { NextResponse } from "next/server";
import type {
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { getResolvedPayrollCodeMappingProfileExact } from "@/src/services/puantaj/payrollCodeMappingResolver.service";
import { updatePayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingDb.service";
import { requirePayrollMappingWriteSession } from "@/app/api/puantaj/payroll-mapping/_auth";
import { logPayrollMappingProfileUpdated } from "@/src/services/puantaj/audit.service";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { code: rawCode } = await context.params;
  const code = String(rawCode ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "BAD_CODE" }, { status: 400 });
  }

  const companyId = await getActiveCompanyId();
  const { company } = await getCompanyBundle();

  const profile = await getResolvedPayrollCodeMappingProfileExact({
    companyId,
    code,
  });

  if (!profile) {
    return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    meta: {
      company: {
        id: companyId,
        name: company?.name ?? "",
      },
    },
    profile: {
      code: profile.code,
      name: profile.name,
      source: profile.source,
      isDefault: !!profile.isDefault,
      isActive: profile.isActive !== false,
      itemCount: profile.items.length,
    },
    items: profile.items.map((item) => ({
      puantajCode: item.puantajCode,
      payrollCode: item.payrollCode,
      payrollLabel: item.payrollLabel,
      unit: item.unit as PuantajPayrollQuantityUnit,
      quantityStrategy: item.quantityStrategy as PuantajPayrollQuantityStrategy,
      fixedQuantity: item.fixedQuantity == null ? null : Number(item.fixedQuantity),
      sortOrder: item.sortOrder,
      source: item.source,
    })),
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { code: rawCode } = await context.params;
    const companyId = await getActiveCompanyId();
    const body: any = await req.json().catch(() => ({}));
    const actorUserId = String((auth.session as any).userId ?? (auth.session as any).id ?? "");

    const profile = await updatePayrollCodeMappingProfile({
      companyId,
      code: String(rawCode ?? ""),
      ...(body?.name !== undefined ? { name: String(body.name ?? "") } : {}),
      ...(body?.isActive !== undefined ? { isActive: !!body.isActive } : {}),
    });

    await logPayrollMappingProfileUpdated({
      companyId,
      actorUserId,
      profileCode: profile.code,
      ...(body?.name !== undefined ? { name: profile.name } : {}),
      ...(body?.isActive !== undefined ? { isActive: profile.isActive } : {}),
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "PROFILE_UPDATE_FAILED",
      },
      { status: 400 }
    );
  }
}