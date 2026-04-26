import { describe, expect, it } from "vitest";
import {
  canRoleUseEmployeeImportPermission,
  getEmployeeImportCapabilities,
} from "../employeeImportPermission.service";

describe("employeeImportPermission.service", () => {
  it("grants system admins every import permission", () => {
    const caps = getEmployeeImportCapabilities("SYSTEM_ADMIN");

    expect(caps).toEqual({
      canAccessWorkspace: true,
      canDownloadTemplate: true,
      canValidate: true,
      canApply: true,
      canReadHistory: true,
      canRecoverOperations: true,
    });
  });

  it("lets HR config admins validate and inspect history without apply", () => {
    const caps = getEmployeeImportCapabilities("HR_CONFIG_ADMIN");

    expect(caps.canAccessWorkspace).toBe(true);
    expect(caps.canDownloadTemplate).toBe(true);
    expect(caps.canValidate).toBe(true);
    expect(caps.canApply).toBe(false);
    expect(caps.canReadHistory).toBe(true);
    expect(caps.canRecoverOperations).toBe(false);
  });

  it("keeps HR operators on the full operational import path", () => {
    expect(canRoleUseEmployeeImportPermission("HR_OPERATOR", "TEMPLATE_DOWNLOAD")).toBe(true);
    expect(canRoleUseEmployeeImportPermission("HR_OPERATOR", "VALIDATE")).toBe(true);
    expect(canRoleUseEmployeeImportPermission("HR_OPERATOR", "APPLY")).toBe(true);
    expect(canRoleUseEmployeeImportPermission("HR_OPERATOR", "RUN_HISTORY_READ")).toBe(true);
    expect(canRoleUseEmployeeImportPermission("HR_OPERATOR", "RUN_OPERATIONS")).toBe(false);
  });

  it("keeps supervisors outside the import workspace", () => {
    const caps = getEmployeeImportCapabilities("SUPERVISOR");

    expect(caps).toEqual({
      canAccessWorkspace: false,
      canDownloadTemplate: false,
      canValidate: false,
      canApply: false,
      canReadHistory: false,
      canRecoverOperations: false,
    });
  });

  it("returns no permissions for missing roles", () => {
    const caps = getEmployeeImportCapabilities(null);

    expect(caps.canAccessWorkspace).toBe(false);
    expect(caps.canDownloadTemplate).toBe(false);
    expect(caps.canValidate).toBe(false);
    expect(caps.canApply).toBe(false);
    expect(caps.canReadHistory).toBe(false);
    expect(caps.canRecoverOperations).toBe(false);
  });
});
