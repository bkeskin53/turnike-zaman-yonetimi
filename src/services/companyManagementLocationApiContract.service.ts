import type { CompanyManagementLocationRecord } from "@/src/repositories/companyManagementLocation.repo";
import type {
  CompanyManagementLocationMutationInput,
} from "@/src/services/companyManagementLocation.service";

function hasOwn(input: unknown, key: string) {
  return !!input && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, key);
}

function readOptionalString(body: any, key: string): string | undefined {
  if (!hasOwn(body, key)) {
    return undefined;
  }

  return String(body?.[key] ?? "");
}

function readOptionalBoolean(body: any, key: string): boolean | undefined {
  if (!hasOwn(body, key)) {
    return undefined;
  }

  const value = body?.[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (value == null) {
    return undefined;
  }

  const text = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "active", "aktif"].includes(text)) {
    return true;
  }

  if (["false", "0", "no", "inactive", "pasif"].includes(text)) {
    return false;
  }

  throw new Error("LOCATION_IS_ACTIVE_INVALID");
}

export function toCompanyManagementLocationMutationInput(
  body: any,
): CompanyManagementLocationMutationInput {
  return {
    code: readOptionalString(body, "code"),
    name: readOptionalString(body, "name"),
    locationGroupId: readOptionalString(body, "locationGroupId"),
    isActive: readOptionalBoolean(body, "isActive"),
  };
}

export function isCompanyManagementLocationMutationValidationError(e: unknown) {
  const msg = typeof (e as any)?.message === "string" ? (e as any).message : "";
  return (
    msg === "LOCATION_NOT_FOUND" ||
    msg === "LOCATION_CODE_REQUIRED" ||
    msg === "LOCATION_CODE_TOO_LONG" ||
    msg === "LOCATION_CODE_INVALID" ||
    msg === "LOCATION_CODE_ALREADY_EXISTS" ||
    msg === "LOCATION_NAME_REQUIRED" ||
    msg === "LOCATION_NAME_TOO_LONG" ||
    msg === "LOCATION_GROUP_REQUIRED" ||
    msg === "LOCATION_GROUP_NOT_FOUND" ||
    msg === "LOCATION_GROUP_INACTIVE" ||
    msg === "LOCATION_IS_ACTIVE_INVALID"
  );
}

export function toCompanyManagementLocationDto(
  item: CompanyManagementLocationRecord,
) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    isActive: item.isActive,
    locationGroupId: item.locationGroupId,
    locationGroup: item.locationGroup
      ? {
          id: item.locationGroup.id,
          code: item.locationGroup.code,
          name: item.locationGroup.name,
          isActive: item.locationGroup.isActive,
        }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toCompanyManagementLocationDtos(
  items: CompanyManagementLocationRecord[],
) {
  return items.map((item) => toCompanyManagementLocationDto(item));
}

export function companyManagementLocationAuditDetails(
  op: string,
  item: CompanyManagementLocationRecord | null | undefined,
  extra: Record<string, any> = {},
) {
  return {
    op,
    scope: "COMPANY_MANAGEMENT_LOCATION",
    branchId: item?.id ?? null,
    locationId: item?.id ?? null,
    code: item?.code ?? null,
    name: item?.name ?? null,
    isActive: item?.isActive ?? null,
    locationGroupId: item?.locationGroupId ?? null,
    locationGroupCode: item?.locationGroup?.code ?? null,
    ...extra,
  };
}