import {
  createCompanyManagementLocation,
  deleteCompanyManagementLocation,
  findCompanyManagementLocationByCode,
  findCompanyManagementLocationById,
  listCompanyManagementLocations,
  updateCompanyManagementLocation,
} from "@/src/repositories/companyManagementLocation.repo";
import { getLocationGroupForCompany } from "@/src/services/locationGroup.service";

export type CompanyManagementLocationMutationInput = {
  code?: string | null;
  name?: string | null;
  locationGroupId?: string | null;
  isActive?: boolean | null;
};

export type CompanyManagementLocationListInput = {
  activeOnly?: boolean;
  locationGroupId?: string | null;
};

const LOCATION_CODE_MAX_LENGTH = 50;
const LOCATION_NAME_MAX_LENGTH = 200;
const LOCATION_CODE_PATTERN = /^[A-Z0-9._-]+$/;

export function normalizeCompanyManagementLocationCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();

  if (!code) {
    throw new Error("LOCATION_CODE_REQUIRED");
  }

  if (code.length > LOCATION_CODE_MAX_LENGTH) {
    throw new Error("LOCATION_CODE_TOO_LONG");
  }

  if (!LOCATION_CODE_PATTERN.test(code)) {
    throw new Error("LOCATION_CODE_INVALID");
  }

  return code;
}

export function normalizeCompanyManagementLocationName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!name) {
    throw new Error("LOCATION_NAME_REQUIRED");
  }

  if (name.length > LOCATION_NAME_MAX_LENGTH) {
    throw new Error("LOCATION_NAME_TOO_LONG");
  }

  return name;
}

function normalizeLocationGroupId(value: unknown) {
  const locationGroupId = String(value ?? "").trim();

  if (!locationGroupId) {
    throw new Error("LOCATION_GROUP_REQUIRED");
  }

  return locationGroupId;
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

async function assertAssignableLocationGroup(
  companyId: string,
  locationGroupId: string,
) {
  const locationGroup = await getLocationGroupForCompany(companyId, locationGroupId);

  if (!locationGroup) {
    throw new Error("LOCATION_GROUP_NOT_FOUND");
  }

  if (!locationGroup.isActive) {
    throw new Error("LOCATION_GROUP_INACTIVE");
  }

  return locationGroup;
}

export async function listLocationsForCompany(
  companyId: string,
  input: CompanyManagementLocationListInput = {},
) {
  const locationGroupId = input.locationGroupId
    ? String(input.locationGroupId).trim()
    : null;

  return listCompanyManagementLocations({
    companyId,
    activeOnly: input.activeOnly === true,
    locationGroupId: locationGroupId || null,
  });
}

export async function getLocationForCompany(companyId: string, id: string) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_NOT_FOUND");
  }

  return findCompanyManagementLocationById(companyId, normalizedId);
}

export async function createLocationForCompany(
  companyId: string,
  input: CompanyManagementLocationMutationInput,
) {
  const code = normalizeCompanyManagementLocationCode(input.code);
  const name = normalizeCompanyManagementLocationName(input.name);
  const locationGroupId = normalizeLocationGroupId(input.locationGroupId);
  const isActive = resolveMutationIsActive(input.isActive, true);

  await assertAssignableLocationGroup(companyId, locationGroupId);

  const duplicate = await findCompanyManagementLocationByCode(companyId, code);
  if (duplicate) {
    throw new Error("LOCATION_CODE_ALREADY_EXISTS");
  }

  return createCompanyManagementLocation({
    companyId,
    locationGroupId,
    code,
    name,
    isActive,
  });
}

export async function updateLocationForCompany(
  companyId: string,
  id: string,
  input: CompanyManagementLocationMutationInput,
) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_NOT_FOUND");
  }

  const existing = await findCompanyManagementLocationById(companyId, normalizedId);
  if (!existing) {
    throw new Error("LOCATION_NOT_FOUND");
  }

  const code =
    typeof input.code === "undefined"
      ? existing.code
      : normalizeCompanyManagementLocationCode(input.code);
  const name =
    typeof input.name === "undefined"
      ? existing.name
      : normalizeCompanyManagementLocationName(input.name);
  const isActive = resolveMutationIsActive(input.isActive, existing.isActive);

  const locationGroupId =
    typeof input.locationGroupId === "undefined"
      ? existing.locationGroupId
      : normalizeLocationGroupId(input.locationGroupId);

  if (locationGroupId && locationGroupId !== existing.locationGroupId) {
    await assertAssignableLocationGroup(companyId, locationGroupId);
  }

  if (code !== existing.code) {
    const duplicate = await findCompanyManagementLocationByCode(companyId, code);
    if (duplicate && duplicate.id !== existing.id) {
      throw new Error("LOCATION_CODE_ALREADY_EXISTS");
    }
  }

  return updateCompanyManagementLocation({
    companyId,
    id: existing.id,
    locationGroupId,
    code,
    name,
    isActive,
  });
}

export async function deleteLocationForCompany(
  companyId: string,
  id: string,
) {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) {
    throw new Error("LOCATION_NOT_FOUND");
  }

  const existing = await findCompanyManagementLocationById(companyId, normalizedId);
  if (!existing) {
    throw new Error("LOCATION_NOT_FOUND");
  }

  return deleteCompanyManagementLocation({
    companyId,
    id: existing.id,
  });
}