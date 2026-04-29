import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  deleteLocationForCompany,
  getLocationForCompany,
  updateLocationForCompany,
} from "@/src/services/companyManagementLocation.service";
import {
  companyManagementLocationAuditDetails,
  isCompanyManagementLocationMutationValidationError,
  toCompanyManagementLocationDto,
  toCompanyManagementLocationMutationInput,
} from "@/src/services/companyManagementLocationApiContract.service";

function mapCompanyManagementLocationError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
    return authErrorResponse(error);
  }

  if (
    msg === "LOCATION_CODE_ALREADY_EXISTS" ||
    msg.includes("Unique constraint") ||
    msg.includes("P2002")
  ) {
    return NextResponse.json(
      { error: "LOCATION_CODE_ALREADY_EXISTS" },
      { status: 409 },
    );
  }

  if (isCompanyManagementLocationMutationValidationError(error)) {
    return NextResponse.json(
      { error: msg },
      { status: msg === "LOCATION_NOT_FOUND" ? 404 : 400 },
    );
  }

  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(ROLE_SETS.READ_ALL);

    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const item = await getLocationForCompany(companyId, id);

    if (!item) {
      return NextResponse.json(
        { error: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      item: toCompanyManagementLocationDto(item),
    });
  } catch (error) {
    const mapped = mapCompanyManagementLocationError(error);
    if (mapped) return mapped;

    console.error("[company-management/locations/[id]] GET unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await getLocationForCompany(companyId, id);

    if (!existing) {
      return NextResponse.json(
        { error: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const input = toCompanyManagementLocationMutationInput(body);
    const item = await updateLocationForCompany(companyId, id, input);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: companyManagementLocationAuditDetails("UPDATE", item, {
        previous: companyManagementLocationAuditDetails("PREVIOUS", existing),
        changedKeys: body && typeof body === "object" ? Object.keys(body) : [],
      }),
    });

    return NextResponse.json({
      item: toCompanyManagementLocationDto(item),
    });
  } catch (error) {
    const mapped = mapCompanyManagementLocationError(error);
    if (mapped) return mapped;

    console.error("[company-management/locations/[id]] PATCH unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await getLocationForCompany(companyId, id);

    if (!existing) {
      return NextResponse.json(
        { error: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const item = await deleteLocationForCompany(companyId, id);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: companyManagementLocationAuditDetails("DELETE", item),
    });

    return NextResponse.json({
      item: toCompanyManagementLocationDto(item),
    });
  } catch (error) {
    const mapped = mapCompanyManagementLocationError(error);
    if (mapped) return mapped;

    console.error("[company-management/locations/[id]] DELETE unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}