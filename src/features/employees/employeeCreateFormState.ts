export type EmployeeCodeInputMode = "AUTO" | "MANUAL";

export type EmployeeCreateFormState = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  gender: string;
  email: string;
  phone: string;
  cardNo: string;
  deviceUserId: string;
  branchId: string;
  workSchedulePatternId: string;
  employeeGroupId: string;
  employeeSubgroupId: string;
  employmentStartDate: string;
  employmentReason: string;
};

export function createInitialEmployeeCreateForm(args: {
  employeeCode: string;
}): EmployeeCreateFormState {
  return {
    employeeCode: String(args.employeeCode ?? "").trim(),
    firstName: "",
    lastName: "",
    nationalId: "",
    gender: "",
    email: "",
    phone: "",
    cardNo: "",
    deviceUserId: "",
    branchId: "",
    workSchedulePatternId: "",
    employeeGroupId: "",
    employeeSubgroupId: "",
    employmentStartDate: "",
    employmentReason: "",
  };
}

export function createResetEmployeeCreateForm(args: {
  employeeCode: string;
  todayDayKey: string;
}): EmployeeCreateFormState {
  return {
    employeeCode: String(args.employeeCode ?? "").trim(),
    firstName: "",
    lastName: "",
    nationalId: "",
    gender: "",
    email: "",
    phone: "",
    cardNo: "",
    deviceUserId: "",
    branchId: "",
    workSchedulePatternId: "",
    employeeGroupId: "",
    employeeSubgroupId: "",
    employmentStartDate: String(args.todayDayKey ?? "").trim(),
    employmentReason: "",
  };
}

export function resolveEmployeeCodeInputModeForPrefill(
  employeeCode: string,
): EmployeeCodeInputMode {
  return String(employeeCode ?? "").trim() ? "AUTO" : "MANUAL";
}