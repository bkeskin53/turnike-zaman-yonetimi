import { prisma } from "@/src/repositories/prisma";
import { EmployeeImportPreviewRow, EmployeeImportValidationIssue, EmployeeImportCodeResolutionSummary } from "@/src/services/employees/importTemplateValidation.service";
import { EmployeeImportSheetKind } from "@/src/features/employees/importTemplate";

type ResolverParams = {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  rows: EmployeeImportPreviewRow[];
};

type ResolverResult = {
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  summary: EmployeeImportCodeResolutionSummary;
};

type ResolutionBucketKey = keyof EmployeeImportCodeResolutionSummary;

function createBucket() {
  return {
    provided: 0,
    resolved: 0,
    missing: 0,
    inactive: 0,
    mismatchedGroup: 0,
  };
}

function createSummary(): EmployeeImportCodeResolutionSummary {
  return {
    branch: createBucket(),
    employeeGroup: createBucket(),
    employeeSubgroup: createBucket(),
    workSchedulePattern: createBucket(),
  };
}

function issue(line: number, code: string, message: string, opts?: Partial<EmployeeImportValidationIssue>): EmployeeImportValidationIssue {
  return {
    line,
    code,
    message,
    employeeCode: opts?.employeeCode,
    field: opts?.field,
    value: opts?.value,
  };
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeCode(value)).filter(Boolean)));
}

function addBucketCounts(summary: EmployeeImportCodeResolutionSummary, key: ResolutionBucketKey, rows: number, resolverState: "resolved" | "missing" | "inactive" | "mismatchedGroup") {
  summary[key].provided += rows;
  summary[key][resolverState] += rows;
}

export async function resolveEmployeeImportCodes(params: ResolverParams): Promise<ResolverResult> {
  const { companyId, sheetKind, rows } = params;
  const needsOrg = sheetKind === "FULL_DATA" || sheetKind === "ORG_DATA";
  const needsWork = sheetKind === "FULL_DATA" || sheetKind === "WORK_DATA";

  const branchCodes = needsOrg ? uniqueNonEmpty(rows.map((row) => row.values.branchCode)) : [];
  const groupCodes = needsOrg ? uniqueNonEmpty(rows.map((row) => row.values.employeeGroupCode)) : [];
  const subgroupCodes = needsOrg ? uniqueNonEmpty(rows.map((row) => row.values.employeeSubgroupCode)) : [];
  const workScheduleCodes = needsWork ? uniqueNonEmpty(rows.map((row) => row.values.workSchedulePatternCode)) : [];

  const [branches, groups, subgroups, patterns] = await Promise.all([
    branchCodes.length
      ? prisma.branch.findMany({
          where: { companyId },
          select: { id: true, code: true, name: true, isActive: true },
        })
      : Promise.resolve([]),
    groupCodes.length
      ? prisma.employeeGroup.findMany({
          where: { companyId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    subgroupCodes.length
      ? prisma.employeeSubgroup.findMany({
          where: { companyId },
          select: { id: true, code: true, name: true, groupId: true },
        })
      : Promise.resolve([]),
    workScheduleCodes.length
      ? prisma.workSchedulePattern.findMany({
          where: { companyId },
          select: { id: true, code: true, name: true, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  const branchMap = new Map(branches.map((item) => [normalizeCode(item.code), item]));
  const groupMap = new Map(groups.map((item) => [normalizeCode(item.code), item]));
  const subgroupMap = new Map(subgroups.map((item) => [normalizeCode(item.code), item]));
  const patternMap = new Map(patterns.map((item) => [normalizeCode(item.code), item]));

  const summary = createSummary();
  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];

  for (const row of rows) {
    const employeeCode = row.employeeCode || undefined;
    if (needsOrg) {
      const branchCode = normalizeCode(row.values.branchCode);
      if (branchCode) {
        const resolved = branchMap.get(branchCode);
        if (!resolved) {
          addBucketCounts(summary, "branch", 1, "missing");
          errors.push(
            issue(row.line, "BRANCH_CODE_NOT_FOUND", `Lokasyon kodu bulunamadı: ${row.values.branchCode}`, {
              employeeCode,
              field: "branchCode",
              value: String(row.values.branchCode ?? ""),
            })
          );
        } else if (!resolved.isActive) {
          addBucketCounts(summary, "branch", 1, "inactive");
          errors.push(
            issue(row.line, "BRANCH_INACTIVE", `Lokasyon pasif olduğu için kullanılamaz: ${resolved.code}`, {
              employeeCode,
              field: "branchCode",
              value: resolved.code,
            })
          );
        } else {
          addBucketCounts(summary, "branch", 1, "resolved");
        }
      }

      const groupCode = normalizeCode(row.values.employeeGroupCode);
      const subgroupCode = normalizeCode(row.values.employeeSubgroupCode);
      const resolvedGroup = groupCode ? groupMap.get(groupCode) : null;
      const resolvedSubgroup = subgroupCode ? subgroupMap.get(subgroupCode) : null;

      if (groupCode) {
        if (!resolvedGroup) {
          addBucketCounts(summary, "employeeGroup", 1, "missing");
          errors.push(
            issue(row.line, "EMPLOYEE_GROUP_CODE_NOT_FOUND", `Grup kodu bulunamadı: ${row.values.employeeGroupCode}`, {
              employeeCode,
              field: "employeeGroupCode",
              value: String(row.values.employeeGroupCode ?? ""),
            })
          );
        } else {
          addBucketCounts(summary, "employeeGroup", 1, "resolved");
        }
      }

      if (subgroupCode) {
        if (!resolvedSubgroup) {
          addBucketCounts(summary, "employeeSubgroup", 1, "missing");
          errors.push(
            issue(row.line, "EMPLOYEE_SUBGROUP_CODE_NOT_FOUND", `Alt grup kodu bulunamadı: ${row.values.employeeSubgroupCode}`, {
              employeeCode,
              field: "employeeSubgroupCode",
              value: String(row.values.employeeSubgroupCode ?? ""),
            })
          );
        } else if (resolvedGroup && resolvedSubgroup.groupId !== resolvedGroup.id) {
          addBucketCounts(summary, "employeeSubgroup", 1, "mismatchedGroup");
          errors.push(
            issue(row.line, "EMPLOYEE_SUBGROUP_GROUP_MISMATCH", `Alt grup, seçilen grup ile uyumlu değil: ${resolvedSubgroup.code}`, {
              employeeCode,
              field: "employeeSubgroupCode",
              value: resolvedSubgroup.code,
            })
          );
        } else {
          addBucketCounts(summary, "employeeSubgroup", 1, "resolved");
        }
      }
    }

    if (needsWork) {
      const workScheduleCode = normalizeCode(row.values.workSchedulePatternCode);
      if (workScheduleCode) {
        const resolved = patternMap.get(workScheduleCode);
        if (!resolved) {
          addBucketCounts(summary, "workSchedulePattern", 1, "missing");
          errors.push(
            issue(row.line, "WORK_SCHEDULE_PATTERN_CODE_NOT_FOUND", `Çalışma planı kodu bulunamadı: ${row.values.workSchedulePatternCode}`, {
              employeeCode,
              field: "workSchedulePatternCode",
              value: String(row.values.workSchedulePatternCode ?? ""),
            })
          );
        } else if (!resolved.isActive) {
          addBucketCounts(summary, "workSchedulePattern", 1, "inactive");
          errors.push(
            issue(row.line, "WORK_SCHEDULE_PATTERN_INACTIVE", `Çalışma planı pasif olduğu için kullanılamaz: ${resolved.code}`, {
              employeeCode,
              field: "workSchedulePatternCode",
              value: resolved.code,
            })
          );
        } else {
          addBucketCounts(summary, "workSchedulePattern", 1, "resolved");
        }
      }
    }
  }

  if (needsOrg && !branchCodes.length && !groupCodes.length && !subgroupCodes.length) {
    warnings.push(
      issue(1, "NO_ORG_CODES_TO_RESOLVE", "Organizasyon kodları bu tabloda çözülmedi; ilgili alanlar boş veya satır yok.")
    );
  }
  if (needsWork && !workScheduleCodes.length) {
    warnings.push(
      issue(1, "NO_WORK_CODES_TO_RESOLVE", "Çalışma planı kodları bu tabloda çözülmedi; ilgili alanlar boş veya satır yok.")
    );
  }

  return { errors, warnings, summary };
}