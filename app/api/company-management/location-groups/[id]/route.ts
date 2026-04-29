import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  deleteLocationGroupForCompany,
  getLocationGroupForCompany,
  updateLocationGroupForCompany,
} from "@/src/services/locationGroup.service";
import {
  isLocationGroupMutationValidationError,
  locationGroupAuditDetails,
  toLocationGroupDto,
  toLocationGroupMutationInput,
} from "@/src/services/locationGroupApiContract.service";

function mapLocationGroupError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
    return authErrorResponse(error);
  }

  if (
    msg === "LOCATION_GROUP_CODE_ALREADY_EXISTS" ||
    msg.includes("Unique constraint") ||
    msg.includes("P2002")
  ) {
    return NextResponse.json(
      { error: "LOCATION_GROUP_CODE_ALREADY_EXISTS" },
      { status: 409 },
    );
  }

  if (isLocationGroupMutationValidationError(error)) {
    return NextResponse.json(
      { error: msg },
      { status: msg === "LOCATION_GROUP_NOT_FOUND" ? 404 : 400 },
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
    const item = await getLocationGroupForCompany(companyId, id);

    if (!item) {
      return NextResponse.json(
        { error: "LOCATION_GROUP_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: toLocationGroupDto(item) });
  } catch (error) {
    const mapped = mapLocationGroupError(error);
    if (mapped) return mapped;

    console.error("[company-management/location-groups/[id]] GET unexpected error", error);
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
    const existing = await getLocationGroupForCompany(companyId, id);

    if (!existing) {
      return NextResponse.json(
        { error: "LOCATION_GROUP_NOT_FOUND" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const input = toLocationGroupMutationInput(body);
    const item = await updateLocationGroupForCompany(companyId, id, input);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: locationGroupAuditDetails("UPDATE", item, {
        previous: locationGroupAuditDetails("PREVIOUS", existing),
        changedKeys: body && typeof body === "object" ? Object.keys(body) : [],
      }),
    });

    return NextResponse.json({ item: toLocationGroupDto(item) });
  } catch (error) {
    const mapped = mapLocationGroupError(error);
    if (mapped) return mapped;

    console.error("[company-management/location-groups/[id]] PATCH unexpected error", error);
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
    const existing = await getLocationGroupForCompany(companyId, id);

    if (!existing) {
      return NextResponse.json(
        { error: "LOCATION_GROUP_NOT_FOUND" },
        { status: 404 },
      );
    }

    const item = await deleteLocationGroupForCompany(companyId, id);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: locationGroupAuditDetails("DELETE", item),
    });

    return NextResponse.json({ item: toLocationGroupDto(item) });
  } catch (error) {
    const mapped = mapLocationGroupError(error);
    if (mapped) return mapped;

    console.error(
      "[company-management/location-groups/[id]] DELETE unexpected error",
      error,
    );
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}