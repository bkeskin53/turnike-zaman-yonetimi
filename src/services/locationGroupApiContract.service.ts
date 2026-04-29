import type { LocationGroupRecord } from "@/src/repositories/locationGroup.repo";
import type { LocationGroupMutationInput } from "@/src/services/locationGroup.service";

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

  throw new Error("LOCATION_GROUP_IS_ACTIVE_INVALID");
}

export function toLocationGroupMutationInput(body: any): LocationGroupMutationInput {
  return {
    code: readOptionalString(body, "code"),
    name: readOptionalString(body, "name"),
    isActive: readOptionalBoolean(body, "isActive"),
  };
}

export function isLocationGroupMutationValidationError(e: unknown) {
  const msg = typeof (e as any)?.message === "string" ? (e as any).message : "";
  return (
    msg === "LOCATION_GROUP_NOT_FOUND" ||
    msg === "LOCATION_GROUP_CODE_REQUIRED" ||
    msg === "LOCATION_GROUP_CODE_TOO_LONG" ||
    msg === "LOCATION_GROUP_CODE_INVALID" ||
    msg === "LOCATION_GROUP_CODE_ALREADY_EXISTS" ||
    msg === "LOCATION_GROUP_NAME_REQUIRED" ||
    msg === "LOCATION_GROUP_NAME_TOO_LONG" ||
    msg === "LOCATION_GROUP_IS_ACTIVE_INVALID"
  );
}

export function toLocationGroupDto(item: LocationGroupRecord) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toLocationGroupDtos(items: LocationGroupRecord[]) {
  return items.map((item) => toLocationGroupDto(item));
}

export function locationGroupAuditDetails(
  op: string,
  item: LocationGroupRecord | null | undefined,
  extra: Record<string, any> = {},
) {
  return {
    op,
    scope: "COMPANY_MANAGEMENT_LOCATION_GROUP",
    locationGroupId: item?.id ?? null,
    code: item?.code ?? null,
    name: item?.name ?? null,
    isActive: item?.isActive ?? null,
    ...extra,
  };
}