import { prisma } from "@/src/repositories/prisma";

export const EMPLOYEE_CODE_SEQUENCE_WIDTH = 8;
export const EMPLOYEE_CODE_SEQUENCE_MIN = 1;
export const EMPLOYEE_CODE_SEQUENCE_MAX = 99_999_999;

type EmployeeCodeSequenceReader = {
  employee: {
    findMany(args: {
      where: {
        companyId: string;
      };
      select: {
        employeeCode: true;
      };
    }): Promise<Array<{ employeeCode: string }>>;
  };
};

export class EmployeeCodeSequenceError extends Error {
  code:
    | "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED"
    | "EMPLOYEE_CODE_SEQUENCE_INVALID_VALUE";

  constructor(
    code:
      | "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED"
      | "EMPLOYEE_CODE_SEQUENCE_INVALID_VALUE",
    message: string,
  ) {
    super(message);
    this.name = "EmployeeCodeSequenceError";
    this.code = code;
  }
}

export function isEmployeeCodeSequenceCandidate(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim();
  return /^\d{1,8}$/.test(normalized);
}

export function parseEmployeeCodeSequenceValue(
  value: string | null | undefined,
): number | null {
  const normalized = String(value ?? "").trim();
  if (!isEmployeeCodeSequenceCandidate(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < EMPLOYEE_CODE_SEQUENCE_MIN) {
    return null;
  }
  if (parsed > EMPLOYEE_CODE_SEQUENCE_MAX) {
    return null;
  }

  return parsed;
}

export function formatEmployeeCodeSequenceValue(value: number): string {
  if (!Number.isInteger(value) || value < EMPLOYEE_CODE_SEQUENCE_MIN) {
    throw new EmployeeCodeSequenceError(
      "EMPLOYEE_CODE_SEQUENCE_INVALID_VALUE",
      "Employee code sequence value must be a positive integer.",
    );
  }
  if (value > EMPLOYEE_CODE_SEQUENCE_MAX) {
    throw new EmployeeCodeSequenceError(
      "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED",
      "Employee code sequence exceeded the supported 8-digit range.",
    );
  }

  return String(value).padStart(EMPLOYEE_CODE_SEQUENCE_WIDTH, "0");
}

export function resolveNextEmployeeCodeFromValues(
  values: Array<string | null | undefined>,
): string {
  let maxValue = 0;

  for (const value of values) {
    const parsed = parseEmployeeCodeSequenceValue(value);
    if (parsed === null) continue;
    if (parsed > maxValue) {
      maxValue = parsed;
    }
  }

  const nextValue = maxValue + 1;
  return formatEmployeeCodeSequenceValue(nextValue);
}

export async function resolveNextEmployeeCode(args: {
  companyId: string;
  db?: EmployeeCodeSequenceReader;
}): Promise<string> {
  const db = (args.db ?? prisma) as EmployeeCodeSequenceReader;

  const employees = await db.employee.findMany({
    where: {
      companyId: args.companyId,
    },
    select: {
      employeeCode: true,
    },
  });

  return resolveNextEmployeeCodeFromValues(
    employees.map((item) => item.employeeCode),
  );
}