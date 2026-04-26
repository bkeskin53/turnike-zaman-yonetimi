import { AuditAction, AuditTargetType, Prisma, UserRole } from "@prisma/client";
import { writeAudit } from "@/src/audit/writeAudit";
import { prisma } from "@/src/repositories/prisma";
import {
  EmployeeImportPreviewRow,
  EmployeeImportValidationIssue,
} from "@/src/services/employees/importTemplateValidation.service";
import {
  backfillEmployeeHistoryForEmployee,
  EmployeeProfileVersionPayload,
} from "@/src/services/employeeHistory.service";
import {
  applyEmployeeProfileVersionChange,
  applyEmployeeProfileVersionFiniteRangeChange,
  syncEmployeeCurrentProfileFromHistory,
} from "@/src/services/employees/employeeProfileVersionMutation.service";

function issue(
  line: number,
  code: string,
  message: string,
  opts?: Partial<EmployeeImportValidationIssue>,
): EmployeeImportValidationIssue {
  return {
    line,
    code,
    message,
    employeeCode: opts?.employeeCode,
    field: opts?.field,
    value: opts?.value,
  };
}

function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeNationalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  return text ? text.replace(/\D+/g, "") : null;
}

function isValidNationalId(value: string): boolean {
  return /^\d{11}$/.test(value);
}

function normalizePhone(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  return text ? text.replace(/[^\d+]/g, "") : null;
}

function normalizeGender(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper === "M" || upper === "ERKEK") return "MALE";
  if (upper === "F" || upper === "KADIN") return "FEMALE";
  return upper;
}

function isAllowedGender(value: string): boolean {
  return value === "MALE" || value === "FEMALE";
}

export function buildEmployeePersonalImportPayload(args: {
  row: EmployeeImportPreviewRow;
  employee: {
    employeeCode: string;
    cardNo: string | null;
    firstName: string;
    lastName: string;
    email: string | null;
    nationalId: string | null;
    phone: string | null;
    gender: string | null;
  };
}): { payload: EmployeeProfileVersionPayload | null; errors: EmployeeImportValidationIssue[] } {
  const { row, employee } = args;
  const employeeCode = row.employeeCode || undefined;
  const errors: EmployeeImportValidationIssue[] = [];

  const firstName = normalizeOptionalText(row.values.firstName) ?? employee.firstName;
  const lastName = normalizeOptionalText(row.values.lastName) ?? employee.lastName;
  const email = normalizeOptionalText(row.values.email) ?? employee.email ?? null;

  const nationalIdRaw = normalizeOptionalText(row.values.nationalId);
  const nationalId =
    nationalIdRaw !== null ? normalizeNationalId(nationalIdRaw) : employee.nationalId ?? null;
  if (nationalIdRaw !== null && nationalId && !isValidNationalId(nationalId)) {
    errors.push(
      issue(row.line, "INVALID_NATIONAL_ID", "TC Kimlik No 11 haneli olmalidir.", {
        employeeCode,
        field: "nationalId",
        value: nationalIdRaw,
      }),
    );
  }

  const phoneRaw = normalizeOptionalText(row.values.phone);
  const phone = phoneRaw !== null ? normalizePhone(phoneRaw) : employee.phone ?? null;
  if (phoneRaw !== null && phone && phone.length > 30) {
    errors.push(
      issue(row.line, "PHONE_TOO_LONG", "Telefon alani 30 karakteri asamaz.", {
        employeeCode,
        field: "phone",
        value: phoneRaw,
      }),
    );
  }

  const genderRaw = normalizeOptionalText(row.values.gender);
  const gender = genderRaw !== null ? normalizeGender(genderRaw) : employee.gender ?? null;
  if (genderRaw !== null && gender && !isAllowedGender(gender)) {
    errors.push(
      issue(row.line, "INVALID_GENDER", "Cinsiyet degeri MALE / FEMALE olarak cozulmelidir.", {
        employeeCode,
        field: "gender",
        value: genderRaw,
      }),
    );
  }

  if (!firstName) {
    errors.push(
      issue(row.line, "FIRST_NAME_REQUIRED", "Ad alani bos birakilamaz.", {
        employeeCode,
        field: "firstName",
      }),
    );
  }
  if (!lastName) {
    errors.push(
      issue(row.line, "LAST_NAME_REQUIRED", "Soyad alani bos birakilamaz.", {
        employeeCode,
        field: "lastName",
      }),
    );
  }

  if (errors.length > 0) return { payload: null, errors };

  return {
    payload: {
      employeeCode: employee.employeeCode,
      cardNo: employee.cardNo ?? null,
      firstName,
      lastName,
      email,
      nationalId,
      phone,
      gender,
    },
    errors,
  };
}

export type EmployeePersonalImportApplySummary = {
  requested: number;
  found: number;
  changed: number;
  unchanged: number;
  rejected: number;
  profileChanged: number;
  cardFilled: number;
  employeeNotFound: number;
  cardConflict: number;
  invalidPersonalValues: number;
};

export type EmployeePersonalImportEmployeeRecord = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
  cardNo: string | null;
};

export type EmployeePersonalImportCardOwnerRecord = {
  id: string;
  employeeCode: string;
  cardNo: string | null;
};

export type EmployeePersonalImportRowResult = {
  status: "changed" | "no_change" | "rejected";
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  profileChanged: boolean;
  cardFilled: boolean;
  employeeNotFound: boolean;
  cardConflict: boolean;
  invalidPersonalValues: boolean;
  employee: EmployeePersonalImportEmployeeRecord | null;
};

export async function applyEmployeePersonalImportRow(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  todayKey: string;
  row: EmployeeImportPreviewRow;
  employee: EmployeePersonalImportEmployeeRecord | null;
  uploadCardOwners: Map<string, Set<string>>;
  cardOwnerByCardNo: Map<string, EmployeePersonalImportCardOwnerRecord>;
}): Promise<EmployeePersonalImportRowResult> {
  const warnings: EmployeeImportValidationIssue[] = [];

  if (!args.employee) {
    return {
      status: "rejected",
      errors: [
        issue(args.row.line, "EMPLOYEE_NOT_FOUND", `Calisan bulunamadi: ${args.row.employeeCode}`, {
          employeeCode: args.row.employeeCode,
          field: "employeeCode",
          value: args.row.employeeCode,
        }),
      ],
      warnings,
      profileChanged: false,
      cardFilled: false,
      employeeNotFound: true,
      cardConflict: false,
      invalidPersonalValues: false,
      employee: null,
    };
  }

  const uploadOwners = args.uploadCardOwners.get(args.row.cardNo);
  if (
    uploadOwners &&
    (uploadOwners.size > 1 || (uploadOwners.size === 1 && !uploadOwners.has(args.employee.employeeCode)))
  ) {
    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "CARD_NO_DUPLICATE_IN_UPLOAD",
          `Ayni Kart ID ayni yuk icinde birden fazla calisana atanmis: ${args.row.cardNo}`,
          {
            employeeCode: args.row.employeeCode,
            field: "cardNo",
            value: args.row.cardNo,
          },
        ),
      ],
      warnings,
      profileChanged: false,
      cardFilled: false,
      employeeNotFound: false,
      cardConflict: true,
      invalidPersonalValues: false,
      employee: args.employee,
    };
  }

  const cardOwner = args.cardOwnerByCardNo.get(args.row.cardNo);
  if (cardOwner && cardOwner.id !== args.employee.id) {
    return {
      status: "rejected",
      errors: [
        issue(args.row.line, "CARD_NO_TAKEN", `Kart ID baska bir calisana ait: ${args.row.cardNo}`, {
          employeeCode: args.row.employeeCode,
          field: "cardNo",
          value: args.row.cardNo,
        }),
      ],
      warnings,
      profileChanged: false,
      cardFilled: false,
      employeeNotFound: false,
      cardConflict: true,
      invalidPersonalValues: false,
      employee: args.employee,
    };
  }

  if (args.employee.cardNo && args.employee.cardNo !== args.row.cardNo) {
    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "CARD_NO_MISMATCH",
          `Bu fazda mevcut kart farkliysa degistirilemez. Mevcut: ${args.employee.cardNo} / Gelen: ${args.row.cardNo}`,
          {
            employeeCode: args.row.employeeCode,
            field: "cardNo",
            value: args.row.cardNo,
          },
        ),
      ],
      warnings,
      profileChanged: false,
      cardFilled: false,
      employeeNotFound: false,
      cardConflict: true,
      invalidPersonalValues: false,
      employee: args.employee,
    };
  }

  const merged = buildEmployeePersonalImportPayload({
    row: args.row,
    employee: args.employee,
  });
  if (!merged.payload || merged.errors.length > 0) {
    return {
      status: "rejected",
      errors: merged.errors,
      warnings,
      profileChanged: false,
      cardFilled: false,
      employeeNotFound: false,
      cardConflict: false,
      invalidPersonalValues: true,
      employee: args.employee,
    };
  }

  const shouldFillCard = !args.employee.cardNo && Boolean(args.row.cardNo);

  await backfillEmployeeHistoryForEmployee({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employee.id,
  });

  const profileResult = args.row.scopeEndDate
    ? await applyEmployeeProfileVersionFiniteRangeChange({
        tx: args.tx,
        companyId: args.companyId,
        employeeId: args.employee.id,
        startDayKey: args.row.scopeStartDate,
        endDayKey: args.row.scopeEndDate,
        payload: merged.payload,
      })
    : await applyEmployeeProfileVersionChange({
        tx: args.tx,
        companyId: args.companyId,
        employeeId: args.employee.id,
        effectiveDayKey: args.row.scopeStartDate,
        payload: merged.payload,
      });

  if (shouldFillCard) {
    await args.tx.employee.update({
      where: { id: args.employee.id },
      data: { cardNo: args.row.cardNo },
      select: { id: true },
    });
  }

  const currentProfile = await syncEmployeeCurrentProfileFromHistory({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employee.id,
    dayKey: args.todayKey,
  });

  return {
    status: profileResult.changed || shouldFillCard ? "changed" : "no_change",
    errors: [],
    warnings,
    profileChanged: profileResult.changed,
    cardFilled: shouldFillCard,
    employeeNotFound: false,
    cardConflict: false,
    invalidPersonalValues: false,
    employee: {
      ...args.employee,
      firstName: currentProfile.firstName,
      lastName: currentProfile.lastName,
      email: currentProfile.email ?? null,
      nationalId: currentProfile.nationalId ?? null,
      phone: currentProfile.phone ?? null,
      gender: currentProfile.gender ?? null,
      cardNo: shouldFillCard ? args.row.cardNo : args.employee.cardNo,
    },
  };
}

export async function applyEmployeePersonalImport(args: {
  companyId: string;
  actorUserId: string;
  actorRole: UserRole;
  todayKey: string;
  req?: Request;
  rows: EmployeeImportPreviewRow[];
}) {
  const employeeCodes = Array.from(new Set(args.rows.map((row) => row.employeeCode).filter(Boolean)));
  const incomingCardNos = Array.from(new Set(args.rows.map((row) => row.cardNo).filter(Boolean)));

  const [employees, cardOwners] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId: args.companyId,
        employeeCode: { in: employeeCodes },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        nationalId: true,
        phone: true,
        gender: true,
        cardNo: true,
      },
    }),
    incomingCardNos.length
      ? prisma.employee.findMany({
          where: {
            companyId: args.companyId,
            cardNo: { in: incomingCardNos },
          },
          select: { id: true, employeeCode: true, cardNo: true },
        })
      : Promise.resolve([]),
  ]);

  const employeeByCode = new Map<string, EmployeePersonalImportEmployeeRecord>(
    employees.map((item) => [item.employeeCode, item]),
  );
  const cardOwnerByCardNo = new Map<string, EmployeePersonalImportCardOwnerRecord>(
    cardOwners.filter((item) => item.cardNo).map((item) => [item.cardNo!, item]),
  );
  const uploadCardOwners = new Map<string, Set<string>>();
  for (const row of args.rows) {
    const key = String(row.cardNo ?? "").trim();
    if (!key) continue;
    const bucket = uploadCardOwners.get(key) ?? new Set<string>();
    bucket.add(row.employeeCode);
    uploadCardOwners.set(key, bucket);
  }

  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];
  const changedEmployeeCodes: string[] = [];

  const summary: EmployeePersonalImportApplySummary = {
    requested: args.rows.length,
    found: 0,
    changed: 0,
    unchanged: 0,
    rejected: 0,
    profileChanged: 0,
    cardFilled: 0,
    employeeNotFound: 0,
    cardConflict: 0,
    invalidPersonalValues: 0,
  };

  for (const row of args.rows) {
    const employee = employeeByCode.get(row.employeeCode) ?? null;
    if (employee) summary.found += 1;

    const rowResult = await prisma.$transaction((tx) =>
      applyEmployeePersonalImportRow({
        tx,
        companyId: args.companyId,
        todayKey: args.todayKey,
        row,
        employee,
        uploadCardOwners,
        cardOwnerByCardNo,
      }),
    );

    errors.push(...rowResult.errors);
    warnings.push(...rowResult.warnings);

    if (rowResult.employeeNotFound) {
      summary.rejected += 1;
      summary.employeeNotFound += 1;
      continue;
    }

    if (rowResult.cardConflict) {
      summary.rejected += 1;
      summary.cardConflict += 1;
      continue;
    }

    if (rowResult.invalidPersonalValues) {
      summary.rejected += 1;
      summary.invalidPersonalValues += 1;
      continue;
    }

    if (rowResult.employee) {
      employeeByCode.set(row.employeeCode, rowResult.employee);
      if (rowResult.employee.cardNo) {
        cardOwnerByCardNo.set(rowResult.employee.cardNo, {
          id: rowResult.employee.id,
          employeeCode: rowResult.employee.employeeCode,
          cardNo: rowResult.employee.cardNo,
        });
      }
    }

    if (rowResult.status === "changed") {
      summary.changed += 1;
      if (rowResult.profileChanged) summary.profileChanged += 1;
      if (rowResult.cardFilled) summary.cardFilled += 1;
      changedEmployeeCodes.push(row.employeeCode);
    } else if (rowResult.status === "no_change") {
      summary.unchanged += 1;
    } else {
      summary.rejected += 1;
    }
  }

  await writeAudit({
    req: args.req,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    action: AuditAction.IMPORT,
    targetType: AuditTargetType.EMPLOYEES,
    details: {
      kind: "EMPLOYEE_PERSONAL_IMPORT_PATCH_8_9",
      requested: summary.requested,
      found: summary.found,
      changed: summary.changed,
      unchanged: summary.unchanged,
      rejected: summary.rejected,
      profileChanged: summary.profileChanged,
      cardFilled: summary.cardFilled,
      employeeNotFound: summary.employeeNotFound,
      cardConflict: summary.cardConflict,
      invalidPersonalValues: summary.invalidPersonalValues,
      changedEmployeeCodesPreview: changedEmployeeCodes.slice(0, 20),
      rejectedPreview: errors.slice(0, 20).map((item) => ({
        line: item.line,
        employeeCode: item.employeeCode ?? null,
        code: item.code,
      })),
    },
  });

  return {
    summary,
    errors,
    warnings,
    changedEmployeeCodesPreview: changedEmployeeCodes.slice(0, 20),
  };
}
