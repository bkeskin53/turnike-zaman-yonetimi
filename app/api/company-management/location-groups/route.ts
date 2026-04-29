import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  createLocationGroupForCompany,
  listLocationGroupsForCompany,
} from "@/src/services/locationGroup.service";
import {
  isLocationGroupMutationValidationError,
  locationGroupAuditDetails,
  toLocationGroupDto,
  toLocationGroupDtos,
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
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return null;
}

export async function GET() {
  try {
    await requireRole(ROLE_SETS.READ_ALL);

    const companyId = await getActiveCompanyId();
    const items = await listLocationGroupsForCompany(companyId);

    return NextResponse.json({ items: toLocationGroupDtos(items) });
  } catch (error) {
    const mapped = mapLocationGroupError(error);
    if (mapped) return mapped;

    console.error("[company-management/location-groups] GET unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const body = await req.json().catch(() => ({}));
    const input = toLocationGroupMutationInput(body);
    const item = await createLocationGroupForCompany(companyId, input);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: locationGroupAuditDetails("CREATE", item),
    });

    return NextResponse.json({ item: toLocationGroupDto(item) });
  } catch (error) {
    const mapped = mapLocationGroupError(error);
    if (mapped) return mapped;

    console.error("[company-management/location-groups] POST unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}