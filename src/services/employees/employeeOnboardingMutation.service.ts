import { Prisma } from "@prisma/client";
import {
  upsertEmployeeOrgAssignment,
  upsertEmployeeProfileVersion,
} from "@/src/services/employeeHistory.service";
import { applyEmployeeWorkScheduleAssignmentChange } from "@/src/services/employees/employeeWorkScheduleAssignmentMutation.service";
import { applyEmployeeEmploymentLifecycleMutation } from "@/src/services/employees/employeeEmploymentLifecycleMutation.service";

type Tx = Prisma.TransactionClient;

export type EmployeeOnboardingMutationErrorCode =
  | "INVALID_BRANCH_ID"
  | "WORK_SCHEDULE_REQUIRED"
  | "INVALID_WORK_SCHEDULE_PATTERN_ID"
  | "EMPLOYEE_GROUP_REQUIRED"
  | "EMPLOYEE_SUBGROUP_REQUIRED"
  | "INVALID_EMPLOYEE_GROUP_ID"
  | "INVALID_EMPLOYEE_SUBGROUP_ID"
  | "EMPLOYEE_SUBGROUP_GROUP_MISMATCH";

export class EmployeeOnboardingMutationError extends Error {
  code: EmployeeOnboardingMutationErrorCode;
  meta?: Record<string, unknown>;

  constructor(
    code: EmployeeOnboardingMutationErrorCode,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeOnboardingMutationError";
    this.code = code;
    this.meta = meta;
  }
}

export function isEmployeeOnboardingMutationError(
  error: unknown,
): error is EmployeeOnboardingMutationError {
  return error instanceof EmployeeOnboardingMutationError;
}

export type EmployeeOnboardingMutationResult = {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string | null;
    nationalId: string | null;
    phone: string | null;
    gender: string | null;
    cardNo: string | null;
    deviceUserId: string | null;
    branchId: string | null;
    employeeGroupId: string | null;
    employeeSubgroupId: string | null;
    isActive: boolean;
  };
  employmentStartDayKey: string;
  effectiveDayKey: string;
  derivedIsActive: boolean;
  employmentChanged: boolean;
  profileChanged: boolean;
  orgChanged: boolean;
  workScheduleChanged: boolean;
};

async function resolveValidatedBranchId(args: {
  tx: Tx;
  companyId: string;
  branchId: string | null;
}) {
  if (!args.branchId) return null;

  const branch = await args.tx.branch.findFirst({
    where: {
      id: args.branchId,
      companyId: args.companyId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!branch) {
    throw new EmployeeOnboardingMutationError(
      "INVALID_BRANCH_ID",
      "Lokasyon bulunamadi ya da pasif durumda.",
      { branchId: args.branchId },
    );
  }

  return branch.id;
}

async function resolveValidatedWorkSchedulePatternId(args: {
  tx: Tx;
  companyId: string;
  patternId: string | null;
}) {
  if (!args.patternId) {
    throw new EmployeeOnboardingMutationError(
      "WORK_SCHEDULE_REQUIRED",
      "Calisma plani zorunludur.",
    );
  }

  const pattern = await args.tx.workSchedulePattern.findFirst({
    where: {
      id: args.patternId,
      companyId: args.companyId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!pattern) {
    throw new EmployeeOnboardingMutationError(
      "INVALID_WORK_SCHEDULE_PATTERN_ID",
      "Calisma plani bulunamadi ya da pasif durumda.",
      { patternId: args.patternId },
    );
  }

  return pattern.id;
}

async function resolveValidatedEmployeeGroupId(args: {
  tx: Tx;
  companyId: string;
  employeeGroupId: string | null;
}) {
  if (!args.employeeGroupId) {
    throw new EmployeeOnboardingMutationError(
      "EMPLOYEE_GROUP_REQUIRED",
      "Calisan grubu zorunludur.",
    );
  }

  const group = await args.tx.employeeGroup.findFirst({
    where: {
      id: args.employeeGroupId,
      companyId: args.companyId,
    },
    select: { id: true },
  });

  if (!group) {
    throw new EmployeeOnboardingMutationError(
      "INVALID_EMPLOYEE_GROUP_ID",
      "Calisan grubu bulunamadi.",
      { employeeGroupId: args.employeeGroupId },
    );
  }

  return group.id;
}

async function resolveValidatedEmployeeSubgroup(args: {
  tx: Tx;
  companyId: string;
  employeeSubgroupId: string | null;
}) {
  if (!args.employeeSubgroupId) {
    throw new EmployeeOnboardingMutationError(
      "EMPLOYEE_SUBGROUP_REQUIRED",
      "Calisan alt grubu zorunludur.",
    );
  }

  const subgroup = await args.tx.employeeSubgroup.findFirst({
    where: {
      id: args.employeeSubgroupId,
      companyId: args.companyId,
    },
    select: {
      id: true,
      groupId: true,
    },
  });

  if (!subgroup) {
    throw new EmployeeOnboardingMutationError(
      "INVALID_EMPLOYEE_SUBGROUP_ID",
      "Calisan alt grubu bulunamadi.",
      { employeeSubgroupId: args.employeeSubgroupId },
    );
  }

  return subgroup;
}

export async function applyEmployeeOnboardingMutation(args: {
  tx: Tx;
  companyId: string;
  todayKey: string;
  actorUserId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
  cardNo: string | null;
  deviceUserId: string | null;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  workSchedulePatternId: string | null;
  employmentStartDayKey: string;
  effectiveDayKey: string;
  employmentReason?: string | null;
  actionNote?: string | null;
  actionDetails?: Prisma.InputJsonValue;
}): Promise<EmployeeOnboardingMutationResult> {
  const branchId = await resolveValidatedBranchId({
    tx: args.tx,
    companyId: args.companyId,
    branchId: args.branchId,
  });
  const workSchedulePatternId = await resolveValidatedWorkSchedulePatternId({
    tx: args.tx,
    companyId: args.companyId,
    patternId: args.workSchedulePatternId,
  });
  const employeeGroupId = await resolveValidatedEmployeeGroupId({
    tx: args.tx,
    companyId: args.companyId,
    employeeGroupId: args.employeeGroupId,
  });
  const employeeSubgroup = await resolveValidatedEmployeeSubgroup({
    tx: args.tx,
    companyId: args.companyId,
    employeeSubgroupId: args.employeeSubgroupId,
  });

  if (employeeSubgroup.groupId !== employeeGroupId) {
    throw new EmployeeOnboardingMutationError(
      "EMPLOYEE_SUBGROUP_GROUP_MISMATCH",
      "Secilen alt grup, grup ile uyumlu degil.",
      {
        employeeGroupId,
        employeeSubgroupId: employeeSubgroup.id,
        subgroupGroupId: employeeSubgroup.groupId,
      },
    );
  }

  const employee = await args.tx.employee.create({
    data: {
      companyId: args.companyId,
      employeeCode: args.employeeCode,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      nationalId: args.nationalId,
      phone: args.phone,
      gender: args.gender,
      cardNo: args.cardNo,
      deviceUserId: args.deviceUserId,
      branchId,
      employeeGroupId,
      employeeSubgroupId: employeeSubgroup.id,
      isActive: args.employmentStartDayKey <= args.todayKey,
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
      deviceUserId: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      isActive: true,
    },
  });

  const employmentResult = await applyEmployeeEmploymentLifecycleMutation({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: employee.id,
    todayKey: args.todayKey,
    actorUserId: args.actorUserId,
    action: "HIRE",
    effectiveDayKey: args.employmentStartDayKey,
    reason: args.employmentReason ?? null,
    actionNote: args.actionNote ?? args.employmentReason ?? null,
    ...(args.actionDetails !== undefined ? { actionDetails: args.actionDetails } : {}),
  });

  const profileResult = await upsertEmployeeProfileVersion({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: employee.id,
    effectiveDayKey: args.effectiveDayKey,
    payload: {
      employeeCode: employee.employeeCode,
      cardNo: employee.cardNo ?? null,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email ?? null,
      nationalId: employee.nationalId ?? null,
      phone: employee.phone ?? null,
      gender: employee.gender ?? null,
    },
  });

  const orgResult = await upsertEmployeeOrgAssignment({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: employee.id,
    effectiveDayKey: args.effectiveDayKey,
    payload: {
      branchId: employee.branchId ?? null,
      employeeGroupId: employee.employeeGroupId ?? null,
      employeeSubgroupId: employee.employeeSubgroupId ?? null,
    },
  });

  const workScheduleResult = await applyEmployeeWorkScheduleAssignmentChange({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: employee.id,
    patternId: workSchedulePatternId,
    effectiveDayKey: args.effectiveDayKey,
    enforceEmploymentOnEffectiveDate: false,
  });

  return {
    employee: {
      ...employee,
      isActive: employmentResult.employee.isActive,
    },
    employmentStartDayKey: args.employmentStartDayKey,
    effectiveDayKey: args.effectiveDayKey,
    derivedIsActive: employmentResult.derivedIsActive,
    employmentChanged: employmentResult.changed,
    profileChanged: profileResult.changed,
    orgChanged: orgResult.changed,
    workScheduleChanged: workScheduleResult.changed,
  };
}
