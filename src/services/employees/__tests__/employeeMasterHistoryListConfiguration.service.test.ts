import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
  buildDefaultEmployeeMasterHistoryListConfiguration,
  parseEmployeeMasterHistoryListConfigurationFieldKey,
  parseEmployeeMasterHistoryListConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterHistoryListConfiguration";
import {
  mergeEmployeeMasterHistoryListConfigurationOverrides,
  resolveEmployeeMasterHistoryListConfiguration,
} from "../employeeMasterHistoryListConfiguration.service";

describe("employeeMasterHistoryListConfiguration.service", () => {
  it("resolves default configuration when company override is missing", async () => {
    const configuration = await resolveEmployeeMasterHistoryListConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          findUnique: async () => null,
        },
      },
    });

    expect(configuration).toEqual(
      buildDefaultEmployeeMasterHistoryListConfiguration(),
    );
  });

  it("merges company overrides onto the default configuration", async () => {
    const configuration = await resolveEmployeeMasterHistoryListConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          findUnique: async () => ({
            fields: [
              {
                fieldKey: "EMAIL",
                isVisible: false,
              },
            ],
          }),
        },
      } as never,
    });

    expect(configuration).toEqual({
      screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
      fields: {
        email: { isVisible: false },
        phone: { isVisible: true },
      },
    });
  });

  it("rejects invalid screen keys", () => {
    expect(() =>
      parseEmployeeMasterHistoryListConfigurationScreenKey("employees.master"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY");
  });

  it("rejects invalid field keys", () => {
    expect(() =>
      parseEmployeeMasterHistoryListConfigurationFieldKey("gender"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEY");
  });

  it("ignores unrelated field overrides during merge", () => {
    const configuration = mergeEmployeeMasterHistoryListConfigurationOverrides({
      overrides: [
        { fieldKey: "EMAIL", isVisible: false },
        { fieldKey: "PHONE", isVisible: false },
        { fieldKey: "GENDER", isVisible: true },
      ],
    });

    expect(configuration).toEqual({
      screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
      fields: {
        email: { isVisible: false },
        phone: { isVisible: false },
      },
    });
  });
});
