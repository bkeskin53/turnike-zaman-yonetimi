import { describe, expect, it, vi } from "vitest";
import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import {
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
  buildDefaultEmployeeMasterHistoryListConfiguration,
} from "@/src/features/employees/employeeMasterHistoryListConfiguration";
import {
  resetEmployeeMasterHistoryListConfiguration,
  saveEmployeeMasterHistoryListConfiguration,
} from "../employeeMasterHistoryListConfigurationMutation.service";

function buildValidFields(overrides: Partial<Record<string, boolean>> = {}) {
  return EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_DEFINITIONS.map(
    ({ fieldKey }) => ({
      fieldKey,
      isVisible: overrides[fieldKey] ?? true,
    }),
  );
}

describe("employeeMasterHistoryListConfigurationMutation", () => {
  it("rejects invalid screen keys", async () => {
    await expect(
      saveEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        input: {
          screenKey: "employees.master.history",
          fields: buildValidFields(),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY",
    });

    await expect(
      resetEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        screenKey: "employees.master.history",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY",
    });
  });

  it("rejects invalid field keys", async () => {
    const fields = buildValidFields() as Array<{
      fieldKey: string;
      isVisible: boolean;
    }>;
    fields[0] = {
      fieldKey: "gender",
      isVisible: true,
    };

    await expect(
      saveEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEY",
    });
  });

  it("rejects invalid visibility settings", async () => {
    const fields = buildValidFields();
    fields[0] = {
      fieldKey: "email",
      isVisible: "yes" as unknown as boolean,
    };

    await expect(
      saveEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
          fields,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_VISIBILITY",
    });
  });

  it("rejects duplicate or incomplete field sets", async () => {
    await expect(
      saveEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
          fields: [
            ...buildValidFields().slice(0, 1),
            { fieldKey: "email", isVisible: false },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET",
    });

    await expect(
      saveEmployeeMasterHistoryListConfiguration({
        companyId: "company_1",
        input: {
          screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
          fields: buildValidFields().slice(0, 1),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET",
    });
  });

  it("saves the exact visibility set and returns merged configuration", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "profile_1" });
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
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

    const resolved = await saveEmployeeMasterHistoryListConfiguration({
      companyId: "company_1",
      input: {
        screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
        fields: buildValidFields({
          email: false,
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
          screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_LIST,
        },
      },
      create: {
        companyId: "company_1",
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_LIST,
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
          fieldKey: ScreenConfigurationFieldKey.EMAIL,
          isVisible: false,
        },
        {
          profileId: "profile_1",
          fieldKey: ScreenConfigurationFieldKey.PHONE,
          isVisible: true,
        },
      ],
    });
    expect(resolved).toEqual({
      screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
      fields: {
        email: { isVisible: false },
        phone: { isVisible: true },
      },
    });
  });

  it("resets to persisted defaults by removing company overrides", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const resolved = await resetEmployeeMasterHistoryListConfiguration({
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
        screenKey: ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_LIST,
      },
    });
    expect(resolved).toEqual(buildDefaultEmployeeMasterHistoryListConfiguration());
  });
});
