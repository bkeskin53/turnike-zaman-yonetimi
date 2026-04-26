import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { backfillEmployeeHistoryForEmployee } from "@/src/services/employeeHistory.service";
import {
  applyEmployeeProfileVersionChange,
  isEmployeeProfileVersionCurrentSyncError,
  syncEmployeeCurrentProfileFromHistory,
} from "@/src/services/employees/employeeProfileVersionMutation.service";
import {
  EmployeeMasterProfileEditDraft,
  EmployeeMasterProfileEditValidationCode,
  normalizeEmployeeMasterProfileEditDraft,
  toEmployeeMasterProfileEditPayload,
  validateEmployeeMasterProfileEditDraft,
} from "@/src/features/employees/masterProfileEditForm";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { previousDayKey, toDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

type Tx = Prisma.TransactionClient;

export type EmployeeMasterProfileVersionedEditErrorCode =
  | EmployeeMasterProfileEditValidationCode
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_CODE_TAKEN"
  | "CARD_NO_TAKEN"
  | "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_TODAY"
  | "NO_ACTIVE_PROFILE_VERSION_FOR_TODAY"
  | "UNIQUE_CONSTRAINT";

export class EmployeeMasterProfileVersionedEditError extends Error {
  code: EmployeeMasterProfileVersionedEditErrorCode;

  constructor(code: EmployeeMasterProfileVersionedEditErrorCode, message: string) {
    super(message);
    this.name = "EmployeeMasterProfileVersionedEditError";
    this.code = code;
  }
}

export function isEmployeeMasterProfileVersionedEditError(
  error: unknown,
): error is EmployeeMasterProfileVersionedEditError {
  return error instanceof EmployeeMasterProfileVersionedEditError;
}

type ProfileVersionPlanRow = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
};

export function buildAppendEmployeeProfileVersionPlan(args: {
  rows: ProfileVersionPlanRow[];
  effectiveDayKey: string;
}): { createValidToDayKey: string | null } {
  const nextVersion = args.rows
    .map((row) => ({ ...row, validFromDayKey: toDayKey(row.validFrom) }))
    .filter((row): row is ProfileVersionPlanRow & { validFromDayKey: string } =>
      Boolean(row.validFromDayKey && row.validFromDayKey > args.effectiveDayKey),
    )
    .sort((a, b) => {
      if (a.validFromDayKey !== b.validFromDayKey) return a.validFromDayKey.localeCompare(b.validFromDayKey);
      return a.id.localeCompare(b.id);
    })[0] ?? null;

  return {
    createValidToDayKey: nextVersion ? previousDayKey(nextVersion.validFromDayKey) : null,
  };
}

function draftFromBody(body: Record<string, unknown>): EmployeeMasterProfileEditDraft {
  return normalizeEmployeeMasterProfileEditDraft({
    scopeStartDate: body.scopeStartDate,
    employeeCode: body.employeeCode,
    cardNo: body.cardNo,
    firstName: body.firstName,
    lastName: body.lastName,
    nationalId: body.nationalId,
    gender: body.gender,
    email: body.email,
    phone: body.phone,
  });
}

async function loadVersionRows(args: { tx: Tx; companyId: string; employeeId: string }) {
  return args.tx.employeeProfileVersion.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
    },
  });
}

async function syncEmployeeCurrentProfileFromHistoryOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
}) {
  try {
    return await syncEmployeeCurrentProfileFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.dayKey,
      strict: true,
    });
  } catch (error) {
    if (isEmployeeProfileVersionCurrentSyncError(error)) {
      if (error.code === "EMPLOYEE_NOT_FOUND") {
        throw new EmployeeMasterProfileVersionedEditError("EMPLOYEE_NOT_FOUND", "Employee not found.");
      }
      if (error.code === "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_DAY") {
        throw new EmployeeMasterProfileVersionedEditError(
          "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_TODAY",
          "Multiple active profile versions found for today.",
        );
      }
      if (error.code === "NO_ACTIVE_PROFILE_VERSION_FOR_DAY") {
        throw new EmployeeMasterProfileVersionedEditError("NO_ACTIVE_PROFILE_VERSION_FOR_TODAY", "No active profile version for today.");
      }
    }
    throw error;
  }
}

export async function applyEmployeeMasterProfileVersionedEdit(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  todayKey: string;
  body: Record<string, unknown>;
}) {
  const draft = draftFromBody(args.body);
  const validationCode = validateEmployeeMasterProfileEditDraft(draft);
  if (validationCode) {
    throw new EmployeeMasterProfileVersionedEditError(validationCode, validationCode);
  }

  const payload = toEmployeeMasterProfileEditPayload(draft);
  const effectiveDayKey = payload.scopeStartDate;

  try {
    return await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { companyId: args.companyId, id: args.employeeId },
      select: { id: true, employeeCode: true, cardNo: true },
    });
    if (!employee) {
      throw new EmployeeMasterProfileVersionedEditError("EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    await backfillEmployeeHistoryForEmployee({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const mutation = await applyEmployeeProfileVersionChange({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey,
      payload: {
        employeeCode: payload.employeeCode,
        cardNo: payload.cardNo,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        nationalId: payload.nationalId,
        phone: payload.phone,
        gender: payload.gender,
      },
    });

    const versionRow = await tx.employeeProfileVersion.findUnique({
      where: { id: mutation.versionId },
      select: {
        id: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
      },
    });
    if (!versionRow) {
      throw new Error("PROFILE_VERSION_NOT_FOUND_AFTER_MUTATION");
    }

    const currentProfile = await syncEmployeeCurrentProfileFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayKey,
    });

    const identityChanged =
      employee.employeeCode !== payload.employeeCode || (employee.cardNo ?? null) !== (payload.cardNo ?? null);
    if (identityChanged) {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          employeeCode: payload.employeeCode,
          cardNo: payload.cardNo,
        },
        select: { id: true },
      });
    }

    if (mutation.changed || identityChanged) {
      await tx.employeeAction.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          type: "UPDATE",
          effectiveDate: dbDateFromDayKey(effectiveDayKey),
          note: mutation.changed
            ? "Kimlik ve iletişim bilgileri için sürüm kaydı güncellendi."
            : "Çalışan kimlik bilgileri güncellendi.",
          actorUserId: args.actorUserId,
          details: {
            surface: "MASTER",
            mode: "VERSIONED_EDIT",
            mutationMode: mutation.mode,
            profileVersionId: versionRow.id,
            effectiveDayKey,
            validToDayKey: toDayKey(versionRow.validTo),
            identityChanged,
            fields: [
              "employeeCode",
              "cardNo",
              "firstName",
              "lastName",
              "email",
              "nationalId",
              "phone",
              "gender",
            ],
          },
        },
        select: { id: true },
      });
    }

    return {
      profileVersion: {
        id: versionRow.id,
        validFrom: toDayKey(versionRow.validFrom),
        validTo: toDayKey(versionRow.validTo),
        createdAt: versionRow.createdAt,
      },
      currentProfile,
      identity: {
        employeeCode: payload.employeeCode,
        cardNo: payload.cardNo,
      },
      mutationMode: mutation.mode,
      changed: mutation.changed || identityChanged,
    };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
      if (target.includes("employeeCode")) {
        throw new EmployeeMasterProfileVersionedEditError("EMPLOYEE_CODE_TAKEN", "Employee code already exists.");
      }
      if (target.includes("cardNo")) {
        throw new EmployeeMasterProfileVersionedEditError("CARD_NO_TAKEN", "Card ID already exists.");
      }
      throw new EmployeeMasterProfileVersionedEditError("UNIQUE_CONSTRAINT", "Unique constraint failed.");
    }
    throw error;
  }
}
