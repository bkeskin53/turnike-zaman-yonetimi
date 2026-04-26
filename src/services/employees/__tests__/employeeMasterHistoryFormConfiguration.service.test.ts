import { describe, expect, it, vi } from "vitest";
import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import {
  buildDefaultEmployeeMasterHistoryFormConfiguration,
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
  parseEmployeeMasterHistoryFormConfigurationFieldKey,
  parseEmployeeMasterHistoryFormConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterHistoryFormConfiguration";
import {
  mergeEmployeeMasterHistoryFormConfigurationOverrides,
  resolveEmployeeMasterHistoryFormConfiguration,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "../employeeMasterHistoryFormConfiguration.service";

describe("employeeMasterHistoryFormConfiguration", () => {
  it("resolves default visibility when no company override exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const resolved = await resolveEmployeeMasterHistoryFormConfiguration({
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
          screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_FORM,
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
    expect(resolved).toEqual(buildDefaultEmployeeMasterHistoryFormConfiguration());
  });

  it("merges company overrides onto defaults", async () => {
    const resolved = await resolveEmployeeMasterHistoryFormConfiguration({
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
                fieldKey: ScreenConfigurationFieldKey.EMAIL,
                isVisible: false,
              },
            ],
          }),
        },
      },
    });

    expect(resolved).toEqual({
      screenKey: EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
      fields: {
        gender: { isVisible: false },
        email: { isVisible: false },
        phone: { isVisible: true },
      },
    });
  });

  it("rejects invalid screen keys", () => {
    expect(() =>
      parseEmployeeMasterHistoryFormConfigurationScreenKey(
        "employees.master.history",
      ),
    ).toThrow("INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY");
    expect(() =>
      toScreenConfigurationScreenKey("employees.master.history"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY");
  });

  it("rejects invalid field keys", () => {
    expect(() =>
      parseEmployeeMasterHistoryFormConfigurationFieldKey("cardNo"),
    ).toThrow("INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEY");
    expect(() => toScreenConfigurationFieldKey("cardNo")).toThrow(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEY",
    );
  });

  it("accepts direct field-key overrides in merge helper", () => {
    const resolved = mergeEmployeeMasterHistoryFormConfigurationOverrides({
      overrides: [{ fieldKey: "phone", isVisible: false }],
    });

    expect(resolved.fields.phone.isVisible).toBe(false);
    expect(resolved.fields.gender.isVisible).toBe(true);
  });
});
