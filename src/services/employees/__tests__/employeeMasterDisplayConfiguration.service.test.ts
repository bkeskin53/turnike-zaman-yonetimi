import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
  buildDefaultEmployeeMasterDisplayConfiguration,
  parseEmployeeMasterDisplayConfigurationFieldKey,
  parseEmployeeMasterDisplayConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterDisplayConfiguration";
import {
  mergeEmployeeMasterDisplayConfigurationOverrides,
  resolveEmployeeMasterDisplayConfiguration,
} from "../employeeMasterDisplayConfiguration.service";

describe("employeeMasterDisplayConfiguration.service", () => {
  it("resolves default configuration when company override is missing", async () => {
    const configuration = await resolveEmployeeMasterDisplayConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          findUnique: async () => null,
        },
      },
    });

    expect(configuration).toEqual(
      buildDefaultEmployeeMasterDisplayConfiguration(),
    );
  });

  it("merges company overrides onto the default configuration", async () => {
    const configuration = await resolveEmployeeMasterDisplayConfiguration({
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
      screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
      fields: {
        gender: { isVisible: true },
        email: { isVisible: false },
        phone: { isVisible: true },
      },
    });
  });

  it("rejects invalid screen keys", () => {
    expect(() =>
      parseEmployeeMasterDisplayConfigurationScreenKey("employees.master"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY");
  });

  it("rejects invalid field keys", () => {
    expect(() =>
      parseEmployeeMasterDisplayConfigurationFieldKey("cardNo"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_KEY");
  });

  it("ignores unrelated field overrides during merge", () => {
    const configuration = mergeEmployeeMasterDisplayConfigurationOverrides({
      overrides: [
        { fieldKey: "EMAIL", isVisible: false },
        { fieldKey: "PHONE", isVisible: false },
        { fieldKey: "CARD_NO", isVisible: true },
      ],
    });

    expect(configuration).toEqual({
      screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
      fields: {
        gender: { isVisible: true },
        email: { isVisible: false },
        phone: { isVisible: false },
      },
    });
  });
});
