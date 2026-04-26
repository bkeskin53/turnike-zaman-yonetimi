import { describe, expect, it, vi } from "vitest";
import { ScreenConfigurationFieldKey, ScreenConfigurationScreenKey } from "@prisma/client";
import {
  buildDefaultEmployeeCreateFormConfiguration,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
  parseEmployeeCreateFormConfigurationFieldKey,
  parseEmployeeCreateFormConfigurationScreenKey,
} from "@/src/features/employees/employeeCreateFormConfiguration";
import {
  mergeEmployeeCreateFormConfigurationOverrides,
  resolveEmployeeCreateFormConfiguration,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "../employeeCreateFormConfiguration.service";

describe("employeeCreateFormConfiguration", () => {
  it("resolves default visibility when no company override exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const resolved = await resolveEmployeeCreateFormConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          findUnique,
        },
      },
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        companyId_screenKey: {
          companyId: "company_1",
          screenKey: ScreenConfigurationScreenKey.EMPLOYEES_CREATE,
        },
      },
      select: {
        fields: {
          select: {
            fieldKey: true,
            isVisible: true,
          },
        },
      },
    });
    expect(resolved).toEqual(buildDefaultEmployeeCreateFormConfiguration());
  });

  it("merges company overrides onto defaults", async () => {
    const resolved = await resolveEmployeeCreateFormConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          findUnique: vi.fn().mockResolvedValue({
            fields: [
              {
                fieldKey: ScreenConfigurationFieldKey.GENDER,
                isVisible: false,
              },
              {
                fieldKey: ScreenConfigurationFieldKey.CARD_NO,
                isVisible: false,
              },
            ],
          }),
        },
      },
    });

    expect(resolved).toEqual({
      screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
      fields: {
        gender: { isVisible: false },
        email: { isVisible: true },
        phone: { isVisible: true },
        cardNo: { isVisible: false },
        deviceUserId: { isVisible: true },
      },
    });
  });

  it("rejects invalid screen keys", () => {
    expect(() =>
      parseEmployeeCreateFormConfigurationScreenKey("employees.list"),
    ).toThrow("INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY");
    expect(() => toScreenConfigurationScreenKey("employees.list")).toThrow(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY",
    );
  });

  it("rejects invalid field keys", () => {
    expect(() =>
      parseEmployeeCreateFormConfigurationFieldKey("employeeCode"),
    ).toThrow("INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY");
    expect(() => toScreenConfigurationFieldKey("employeeCode")).toThrow(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY",
    );
  });

  it("accepts direct field-key overrides in merge helper", () => {
    const resolved = mergeEmployeeCreateFormConfigurationOverrides({
      overrides: [{ fieldKey: "phone", isVisible: false }],
    });

    expect(resolved.fields.phone.isVisible).toBe(false);
    expect(resolved.fields.email.isVisible).toBe(true);
  });
});
