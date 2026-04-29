import {
  createLocationGroup,
  deleteLocationGroup,
  findLocationGroupByCode,
  findLocationGroupById,
  listLocationGroups,
  updateLocationGroup,
} from "@/src/repositories/locationGroup.repo";

export type LocationGroupMutationInput = {
  code?: string | null;
  name?: string | null;
  isActive?: boolean | null;
};

const LOCATION_GROUP_CODE_MAX_LENGTH = 50;
const LOCATION_GROUP_NAME_MAX_LENGTH = 200;
const LOCATION_GROUP_CODE_PATTERN = /^[A-Z0-9._-]+$/;

export function normalizeLocationGroupCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();

  if (!code) {
    throw new Error("LOCATION_GROUP_CODE_REQUIRED");
  }

  if (code.length > LOCATION_GROUP_CODE_MAX_LENGTH) {
    throw new Error("LOCATION_GROUP_CODE_TOO_LONG");
  }

  if (!LOCATION_GROUP_CODE_PATTERN.test(code)) {
    throw new Error("LOCATION_GROUP_CODE_INVALID");
  }

  return code;
}

export function normalizeLocationGroupName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!name) {
    throw new Error("LOCATION_GROUP_NAME_REQUIRED");
  }

  if (name.length > LOCATION_GROUP_NAME_MAX_LENGTH) {
    throw new Error("LOCATION_GROUP_NAME_TOO_LONG");
  }

  return name;
}

function resolveMutationIsActive(
  value: boolean | null | undefined,
  fallback: boolean,
) {
  if (value == null) {
    return fallback;
  }

  return value === true;
}

export async function listLocationGroupsForCompany(companyId: string) {
  return listLocationGroups(companyId);
}

export async function getLocationGroupForCompany(companyId: string, id: string) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  return findLocationGroupById(companyId, normalizedId);
}

export async function createLocationGroupForCompany(
  companyId: string,
  input: LocationGroupMutationInput,
) {
  const code = normalizeLocationGroupCode(input.code);
  const name = normalizeLocationGroupName(input.name);
  const isActive = resolveMutationIsActive(input.isActive, true);

  const duplicate = await findLocationGroupByCode(companyId, code);
  if (duplicate) {
    throw new Error("LOCATION_GROUP_CODE_ALREADY_EXISTS");
  }

  return createLocationGroup({
    companyId,
    code,
    name,
    isActive,
  });
}

export async function updateLocationGroupForCompany(
  companyId: string,
  id: string,
  input: LocationGroupMutationInput,
) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  const existing = await findLocationGroupById(companyId, normalizedId);
  if (!existing) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  const code =
    typeof input.code === "undefined"
      ? existing.code
      : normalizeLocationGroupCode(input.code);
  const name =
    typeof input.name === "undefined"
      ? existing.name
      : normalizeLocationGroupName(input.name);
  const isActive = resolveMutationIsActive(input.isActive, existing.isActive);

  if (code !== existing.code) {
    const duplicate = await findLocationGroupByCode(companyId, code);
    if (duplicate && duplicate.id !== existing.id) {
      throw new Error("LOCATION_GROUP_CODE_ALREADY_EXISTS");
    }
  }

  return updateLocationGroup({
    companyId,
    id: existing.id,
    code,
    name,
    isActive,
  });
}

export async function deleteLocationGroupForCompany(
  companyId: string,
  id: string,
) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  const existing = await findLocationGroupById(companyId, normalizedId);
  if (!existing) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  return deleteLocationGroup({
    companyId,
    id: existing.id,
  });
}