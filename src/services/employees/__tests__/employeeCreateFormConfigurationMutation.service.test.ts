import { describe, expect, it, vi } from "vitest";
import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import {
  buildDefaultEmployeeCreateFormConfiguration,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeCreateFormConfiguration";
import {
  resetEmployeeCreateFormConfiguration,
  saveEmployeeCreateFormConfiguration,
} from "../employeeCreateFormConfigurationMutation.service";

function buildValidFields(
  overrides: Partial<Record<string, boolean>> = {},
) {
  return EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
    ({ fieldKey }) => ({
      fieldKey,
      isVisible: overrides[fieldKey] ?? true,
    }),
  );
}

describe("employeeCreateFormConfigurationMutation", () => {
  it("rejects invalid screen keys", async () => {
    await expect(
      saveEmployeeCreateFormConfiguration({
        companyId: "company_1",
        input: {
          screenKey: "employees.list",
          fields: buildValidFields(),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY",
    });

    await expect(
      resetEmployeeCreateFormConfiguration({
        companyId: "company_1",
        screenKey: "employees.list",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY",
    });
  });

  it("rejects invalid field keys", async () => {
    const fields = buildValidFields() as Array<{
      fieldKey: string;
      isVisible: boolean;
    }>;
    fields[0] = {
      fieldKey: "employeeCode",
      isVisible: true,
    };

    await expect(
      saveEmployeeCreateFormConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY",
    });
  });

  it("rejects invalid visibility settings", async () => {
    const fields = buildValidFields();
    fields[0] = {
      fieldKey: "gender",
      isVisible: "yes" as unknown as boolean,
    };

    await expect(
      saveEmployeeCreateFormConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_VISIBILITY",
    });
  });

  it("rejects duplicate or incomplete field sets", async () => {
    await expect(
      saveEmployeeCreateFormConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
          fields: [
            ...buildValidFields().slice(0, 4),
            { fieldKey: "gender", isVisible: false },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET",
    });

    await expect(
      saveEmployeeCreateFormConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
          fields: buildValidFields().slice(0, 4),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET",
    });
  });

  it("saves the exact visibility set and returns merged configuration", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "profile_1" });
    const deleteMany = vi.fn().mockResolvedValue({ count: 5 });
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const transaction = vi.fn(
      async (
        callback: (tx: {
          screenConfigurationProfile: { upsert: typeof upsert };
          screenConfigurationField: {
            deleteMany: typeof deleteMany;
            createMany: typeof createMany;
          };
        }) => Promise<unknown>,
      ) =>
        callback({
          screenConfigurationProfile: { upsert },
          screenConfigurationField: { deleteMany, createMany },
        }),
    );

    const resolved = await saveEmployeeCreateFormConfiguration({
      companyId: "company_1",
      input: {
        screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
        fields: buildValidFields({
          gender: false,
          cardNo: false,
        }),
      },
      db: {
        $transaction: transaction,
      } as never,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: {
        companyId_screenKey: {
          companyId: "company_1",
          screenKey: ScreenConfigurationScreenKey.EMPLOYEES_CREATE,
        },
      },
      create: {
        companyId: "company_1",
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_CREATE,
      },
      update: {},
      select: {
        id: true,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { profileId: "profile_1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.GENDER,
          isVisible: false,
        },
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.EMAIL,
          isVisible: true,
        },
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.PHONE,
          isVisible: true,
        },
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.CARD_NO,
          isVisible: false,
        },
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.DEVICE_USER_ID,
          isVisible: true,
        },
      ],
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

  it("resets to persisted defaults by removing company overrides", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const resolved = await resetEmployeeCreateFormConfiguration({
      companyId: "company_1",
      db: {
        screenConfigurationProfile: {
          deleteMany,
        },
      } as never,
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "company_1",
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_CREATE,
      },
    });
    expect(resolved).toEqual(buildDefaultEmployeeCreateFormConfiguration());
  });
});
