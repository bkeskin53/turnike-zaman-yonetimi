import { NextRequest, NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  createLocationForCompany,
  listLocationsForCompany,
} from "@/src/services/companyManagementLocation.service";
import {
  companyManagementLocationAuditDetails,
  isCompanyManagementLocationMutationValidationError,
  toCompanyManagementLocationDto,
  toCompanyManagementLocationDtos,
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

export async function GET(req: NextRequest) {
  try {
    await requireRole(ROLE_SETS.READ_ALL);

    const companyId = await getActiveCompanyId();
    const activeOnly =
      String(req.nextUrl.searchParams.get("activeOnly") ?? "").trim() === "1";
    const locationGroupId =
      String(req.nextUrl.searchParams.get("locationGroupId") ?? "").trim() || null;

    const items = await listLocationsForCompany(companyId, {
      activeOnly,
      locationGroupId,
    });

    return NextResponse.json({
      items: toCompanyManagementLocationDtos(items),
    });
  } catch (error) {
    const mapped = mapCompanyManagementLocationError(error);
    if (mapped) return mapped;

    console.error("[company-management/locations] GET unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const body = await req.json().catch(() => ({}));
    const input = toCompanyManagementLocationMutationInput(body);
    const item = await createLocationForCompany(companyId, input);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: item.id,
      details: companyManagementLocationAuditDetails("CREATE", item),
    });

    return NextResponse.json({
      item: toCompanyManagementLocationDto(item),
    });
  } catch (error) {
    const mapped = mapCompanyManagementLocationError(error);
    if (mapped) return mapped;

    console.error("[company-management/locations] POST unexpected error", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}