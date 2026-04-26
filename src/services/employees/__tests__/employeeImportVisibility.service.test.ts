import { UserDataScope } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyEmployeeImportVisibilityToCapabilities,
  buildEmployeeImportVisibilityBlockedReason,
  deriveEmployeeImportVisibilityMode,
} from "../employeeImportVisibility.service";

describe("employeeImportVisibility.service", () => {
  it("keeps company-wide import access when user scope is ALL and empty", () => {
    expect(
      deriveEmployeeImportVisibilityMode({
        dataScope: UserDataScope.ALL,
        scopeBranchIds: [],
        scopeEmployeeGroupIds: [],
        scopeEmployeeSubgroupIds: [],
      }),
    ).toBe("COMPANY_ALL");
  });

  it("blocks import workspace when data scope is branch-limited", () => {
    expect(
      deriveEmployeeImportVisibilityMode({
        dataScope: UserDataScope.BRANCH,
        scopeBranchIds: ["branch-a"],
      }),
    ).toBe("LIMITED_USER_SCOPE_BLOCKED");
  });

  it("fails closed when scope arrays are populated even if dataScope says ALL", () => {
    expect(
      deriveEmployeeImportVisibilityMode({
        dataScope: UserDataScope.ALL,
        scopeBranchIds: ["branch-a"],
      }),
    ).toBe("LIMITED_USER_SCOPE_BLOCKED");
  });

  it("keeps template download but blocks validate/apply/history on limited scope", () => {
    const adjusted = applyEmployeeImportVisibilityToCapabilities(
      {
        canAccessWorkspace: true,
        canDownloadTemplate: true,
        canValidate: true,
        canApply: true,
        canReadHistory: true,
        canRecoverOperations: true,
      },
      {
        mode: "LIMITED_USER_SCOPE_BLOCKED",
        blockedReason: buildEmployeeImportVisibilityBlockedReason(),
      },
    );

      expect(adjusted).toEqual({
        canAccessWorkspace: true,
        canDownloadTemplate: true,
        canValidate: false,
        canApply: false,
        canReadHistory: false,
        canRecoverOperations: false,
      });
  });
});
