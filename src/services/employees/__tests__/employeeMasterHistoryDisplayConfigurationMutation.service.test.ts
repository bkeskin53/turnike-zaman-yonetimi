import { describe, expect, it, vi } from "vitest";
import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import {
  buildDefaultEmployeeMasterHistoryDisplayConfiguration,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import {
  resetEmployeeMasterHistoryDisplayConfiguration,
  saveEmployeeMasterHistoryDisplayConfiguration,
} from "../employeeMasterHistoryDisplayConfigurationMutation.service";

function buildValidFields(overrides: Partial<Record<string, boolean>> = {}) {
  return EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS.map(
    ({ fieldKey }) => ({
      fieldKey,
      isVisible: overrides[fieldKey] ?? true,
    }),
  );
}

describe("employeeMasterHistoryDisplayConfigurationMutation", () => {
  it("rejects invalid screen keys", async () => {
    await expect(
      saveEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        input: {
          screenKey: "employees.master",
          fields: buildValidFields(),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY",
    });

    await expect(
      resetEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        screenKey: "employees.master",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY",
    });
  });

  it("rejects invalid field keys", async () => {
    const fields = buildValidFields() as Array<{
      fieldKey: string;
      isVisible: boolean;
    }>;
    fields[0] = {
      fieldKey: "cardNo",
      isVisible: true,
    };

    await expect(
      saveEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEY",
    });
  });

  it("rejects invalid visibility settings", async () => {
    const fields = buildValidFields();
    fields[0] = {
      fieldKey: "gender",
      isVisible: "yes" as unknown as boolean,
    };

    await expect(
      saveEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_VISIBILITY",
    });
  });

  it("rejects duplicate or incomplete field sets", async () => {
    await expect(
      saveEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
          fields: [
            ...buildValidFields().slice(0, 2),
            { fieldKey: "gender", isVisible: false },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET",
    });

    await expect(
      saveEmployeeMasterHistoryDisplayConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
          fields: buildValidFields().slice(0, 2),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET",
    });
  });

  it("saves the exact visibility set and returns merged configuration", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "profile_1" });
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const createMany = vi.fn().mockResolvedValue({ count: 3 });
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

    const resolved = await saveEmployeeMasterHistoryDisplayConfiguration({
      companyId: "company_1",
      input: {
        screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
        fields: buildValidFields({
          gender: false,
          phone: false,
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
          screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY,
        },
      },
      create: {
        companyId: "company_1",
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY,
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
          isVisible: false,
        },
      ],
    });
    expect(resolved).toEqual({
      screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
      fields: {
        gender: { isVisible: false },
        email: { isVisible: true },
        phone: { isVisible: false },
      },
    });
  });

  it("resets to persisted defaults by removing company overrides", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const resolved = await resetEmployeeMasterHistoryDisplayConfiguration({
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
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY,
      },
    });
    expect(resolved).toEqual(
      buildDefaultEmployeeMasterHistoryDisplayConfiguration(),
    );
  });
});
