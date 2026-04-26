import { EmployeeImportSheetKind, formatEmployeeImportSheetTitle } from "@/src/features/employees/importTemplate";
import type {
  EmployeeImportCodeResolutionSummary,
  EmployeeImportHeaderSummary,
} from "@/src/services/employees/importTemplateValidation.service";
import type {
  EmployeeImportIssueGroupKey,
  EmployeeImportIssueSummaryDto,
} from "@/src/services/employees/employeeImportIssueTaxonomy.service";

export type EmployeeImportReadinessStatus = "READY" | "REVIEW" | "BLOCKED";
export type EmployeeImportReadinessCheckStatus = "OK" | "REVIEW" | "BLOCKED";

export type EmployeeImportReadinessCheckDto = {
  key: "HEADER_CONTRACT" | "DATA_QUALITY" | "CODE_RESOLUTION" | "OPERATIONAL_SIGNALS" | "ACTIONABLE_ROWS";
  title: string;
  status: EmployeeImportReadinessCheckStatus;
  summary: string;
};

export type EmployeeImportReadinessConcernDto = {
  title: string;
  severity: "error" | "warning";
  issueCount: number;
  lineCount: number;
  previewLimited: boolean;
};

export type EmployeeImportReadinessSummaryDto = {
  source: "IMPORT_RESULT" | "RUN_DETAIL";
  status: EmployeeImportReadinessStatus;
  headline: string;
  supportText: string;
  actionableRowCount: number;
  invalidRowCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  previewLimited: boolean;
  checks: EmployeeImportReadinessCheckDto[];
  topConcerns: EmployeeImportReadinessConcernDto[];
};

type HeaderStats = {
  receivedHeaders: number;
  missingRequiredHeaders: number;
  unknownHeaders: number;
  duplicateHeaders: number;
  emptyHeaderIndexes: number;
};

type CodeResolutionStats = {
  provided: number;
  resolved: number;
  missing: number;
  inactive: number;
  mismatchedGroup: number;
};

const DATA_QUALITY_KEYS: EmployeeImportIssueGroupKey[] = [
  "REQUIRED_FIELDS",
  "DATE_AND_SCOPE",
  "EMPLOYMENT_CONTEXT",
  "PROFILE_VALUES",
  "EMPLOYEE_MATCHING",
  "CARD_AND_IDENTITY",
];

const CODE_RESOLUTION_KEYS: EmployeeImportIssueGroupKey[] = ["ORG_REFERENCES", "WORK_REFERENCES"];
const OPERATIONAL_KEYS: EmployeeImportIssueGroupKey[] = ["DUPLICATE_INPUT", "SYSTEM_AND_OPERATION"];

function toObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getHeaderStats(value: EmployeeImportHeaderSummary | Record<string, unknown> | null | undefined): HeaderStats {
  const object = toObject(value);
  return {
    receivedHeaders: toStringArray(object?.receivedHeaders).length,
    missingRequiredHeaders: toStringArray(object?.missingRequiredHeaders).length,
    unknownHeaders: toStringArray(object?.unknownHeaders).length,
    duplicateHeaders: toStringArray(object?.duplicateHeaders).length,
    emptyHeaderIndexes: Array.isArray(object?.emptyHeaderIndexes) ? object!.emptyHeaderIndexes.length : 0,
  };
}

function getCodeBucket(value: unknown): CodeResolutionStats {
  const object = toObject(value);
  return {
    provided: toNumber(object?.provided),
    resolved: toNumber(object?.resolved),
    missing: toNumber(object?.missing),
    inactive: toNumber(object?.inactive),
    mismatchedGroup: toNumber(object?.mismatchedGroup),
  };
}

function getCodeResolutionStats(
  value: EmployeeImportCodeResolutionSummary | Record<string, unknown> | null | undefined,
): CodeResolutionStats {
  const object = toObject(value);
  const buckets = [
    getCodeBucket(object?.branch),
    getCodeBucket(object?.employeeGroup),
    getCodeBucket(object?.employeeSubgroup),
    getCodeBucket(object?.workSchedulePattern),
  ];

  return buckets.reduce<CodeResolutionStats>(
    (acc, bucket) => ({
      provided: acc.provided + bucket.provided,
      resolved: acc.resolved + bucket.resolved,
      missing: acc.missing + bucket.missing,
      inactive: acc.inactive + bucket.inactive,
      mismatchedGroup: acc.mismatchedGroup + bucket.mismatchedGroup,
    }),
    {
      provided: 0,
      resolved: 0,
      missing: 0,
      inactive: 0,
      mismatchedGroup: 0,
    },
  );
}

function issueCountByKeys(summary: EmployeeImportIssueSummaryDto, severity: "error" | "warning", keys: EmployeeImportIssueGroupKey[]) {
  const groups = severity === "error" ? summary.errorGroups : summary.warningGroups;
  return groups
    .filter((group) => keys.includes(group.key))
    .reduce((total, group) => total + group.issueCount, 0);
}

function topConcerns(summary: EmployeeImportIssueSummaryDto): EmployeeImportReadinessConcernDto[] {
  return [...summary.errorGroups, ...summary.warningGroups]
    .slice()
    .sort((a, b) => b.issueCount - a.issueCount || b.lineCount - a.lineCount || a.title.localeCompare(b.title, "tr"))
    .slice(0, 3)
    .map((group) => ({
      title: group.title,
      severity: group.severity,
      issueCount: group.issueCount,
      lineCount: group.lineCount,
      previewLimited: group.previewLimited,
    }));
}

function determineReadinessStatus(args: {
  actionableRowCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
}): EmployeeImportReadinessStatus {
  if (args.actionableRowCount <= 0) return "BLOCKED";
  if (args.blockingIssueCount > 0) return "BLOCKED";
  if (args.warningIssueCount > 0) return "REVIEW";
  return "READY";
}

function buildHeadline(args: {
  status: EmployeeImportReadinessStatus;
  actionableRowCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
}): { headline: string; supportText: string } {
  if (args.status === "BLOCKED" && args.actionableRowCount <= 0) {
    return {
      headline: "Uygulanabilir satır bulunmuyor",
      supportText: "Mevcut doğrulama sonucuna göre, veri sorunları düzeltilmeden bu dosya ile ilerlenemez.",
    };
  }

  if (args.status === "BLOCKED") {
    return {
      headline: "Dosya henüz uygulamaya hazır değil",
      supportText: `${args.blockingIssueCount} hata önce düzeltilmeli. Uygulamaya yaklaşan satırları korumak için düzeltme paketini veya satır bazlı sorun listesini kullanabilirsiniz.`,
    };
  }

  if (args.status === "REVIEW") {
    return {
      headline: "Dosya uygulanabilir, ancak gözden geçirme önerilir",
      supportText: `${args.warningIssueCount} uyarı bulundu. Uygulamaya geçmeden önce tekrar eden veya referans niteliğindeki uyarı sinyallerini incelemeniz önerilir.`,
    };
  }

  return {
    headline: "Dosya uygulamaya hazır görünüyor",
    supportText: "Mevcut doğrulama sonucu bloklayıcı sorun göstermiyor. İsterseniz uygulamaya geçebilirsiniz.",
  };
}

function buildChecks(args: {
  sheetKind: EmployeeImportSheetKind;
  actionableRowCount: number;
  invalidRowCount: number;
  issueSummary: EmployeeImportIssueSummaryDto;
  headerStats: HeaderStats;
  codeStats: CodeResolutionStats;
}): EmployeeImportReadinessCheckDto[] {
  const headerProblemCount =
    args.headerStats.missingRequiredHeaders +
    args.headerStats.unknownHeaders +
    args.headerStats.duplicateHeaders +
    args.headerStats.emptyHeaderIndexes;

  const dataQualityErrorCount = issueCountByKeys(args.issueSummary, "error", DATA_QUALITY_KEYS);
  const dataQualityWarningCount = issueCountByKeys(args.issueSummary, "warning", DATA_QUALITY_KEYS);
  const codeErrorCount =
    args.codeStats.missing + args.codeStats.inactive + args.codeStats.mismatchedGroup + issueCountByKeys(args.issueSummary, "error", CODE_RESOLUTION_KEYS);
  const codeWarningCount = issueCountByKeys(args.issueSummary, "warning", CODE_RESOLUTION_KEYS);
  const operationalErrorCount = issueCountByKeys(args.issueSummary, "error", OPERATIONAL_KEYS);
  const operationalWarningCount = issueCountByKeys(args.issueSummary, "warning", OPERATIONAL_KEYS);

  const codeResolutionRequired = args.sheetKind === "FULL_DATA" || args.sheetKind === "ORG_DATA" || args.sheetKind === "WORK_DATA";

  return [
    {
      key: "HEADER_CONTRACT",
      title: "Başlık ve kolon sözleşmesi",
      status: headerProblemCount > 0 ? "BLOCKED" : args.headerStats.receivedHeaders > 0 ? "OK" : "REVIEW",
      summary:
        headerProblemCount > 0
          ? `${headerProblemCount} başlık/kolon problemi bulundu. Eksik zorunlu, tanınmayan veya yinelenen kolonları düzeltin.`
          : args.headerStats.receivedHeaders > 0
            ? `${args.headerStats.receivedHeaders} kolon beklenen sözleşmeyle uyumlu görünüyor.`
            : "Bu koşu için kayıtlı başlık özeti bulunmuyor.",
    },
    {
      key: "DATA_QUALITY",
      title: "Satır ve veri kalitesi",
      status: dataQualityErrorCount > 0 ? "BLOCKED" : dataQualityWarningCount > 0 ? "REVIEW" : "OK",
      summary:
        dataQualityErrorCount > 0
          ? `${dataQualityErrorCount} veri kalitesi hatası mevcut. Eksik alanlar, tarih/kapsam kuralları veya kimlik eşleşmeleri düzeltilmeli.`
          : dataQualityWarningCount > 0
            ? `${dataQualityWarningCount} veri kalitesi uyarısı var. Referans niteliğindeki alanları gözden geçirin.`
            : "Temel satır ve alan kontrolleri temiz görünüyor.",
    },
    {
      key: "CODE_RESOLUTION",
      title: "Kod çözümleme",
      status: codeErrorCount > 0 ? "BLOCKED" : codeWarningCount > 0 ? "REVIEW" : "OK",
      summary:
        !codeResolutionRequired
          ? `${formatEmployeeImportSheetTitle(args.sheetKind)} için ayrıca kod çözümleme gerekmiyor.`
          : codeErrorCount > 0
            ? `${codeErrorCount} kod çözümleme problemi bulundu. Lokasyon, grup, alt grup veya çalışma planı kodları düzeltilmeli.`
            : codeWarningCount > 0
              ? `${codeWarningCount} kod çözümleme uyarısı var. Boş kalan referans alanlarını kontrol edin.`
              : args.codeStats.provided > 0
                ? `${args.codeStats.resolved}/${args.codeStats.provided} referans kaydı başarıyla çözüldü.`
                : "Bu koşuda çözümlenen referans kodu bulunmuyor.",
    },
    {
      key: "OPERATIONAL_SIGNALS",
      title: "Tekrar ve operasyon sinyalleri",
      status: operationalErrorCount > 0 ? "BLOCKED" : operationalWarningCount > 0 ? "REVIEW" : "OK",
      summary:
        operationalErrorCount > 0
          ? `${operationalErrorCount} operasyon hatası kaydı var. Önce bu koşuyu teknik olarak netleştirin.`
          : operationalWarningCount > 0
            ? `${operationalWarningCount} operasyon uyarısında yinelenen içerik veya referans sinyali bulundu.`
            : "Dikkat gerektiren yinelenen içerik ya da operasyon sinyali görünmüyor.",
    },
    {
      key: "ACTIONABLE_ROWS",
      title: "Uygulanabilir satırlar",
      status: args.actionableRowCount <= 0 ? "BLOCKED" : args.invalidRowCount > 0 ? "REVIEW" : "OK",
      summary:
        args.actionableRowCount <= 0
          ? "Bu koşuda uygulamaya geçmeye uygun satır kalmadı."
          : args.invalidRowCount > 0
            ? `${args.actionableRowCount} satır işleme yakın, ${args.invalidRowCount} satır ise önce düzeltme bekliyor.`
            : `${args.actionableRowCount} satır uygulamaya hazır görünüyor.`,
    },
  ];
}

export function buildEmployeeImportResultReadinessSummary(args: {
  sheetKind: EmployeeImportSheetKind;
  actionableRowCount: number;
  invalidRowCount: number;
  issueSummary: EmployeeImportIssueSummaryDto;
  headerSummary: EmployeeImportHeaderSummary;
  codeResolutionSummary?: EmployeeImportCodeResolutionSummary | null;
}): EmployeeImportReadinessSummaryDto {
  const headerStats = getHeaderStats(args.headerSummary);
  const codeStats = getCodeResolutionStats(args.codeResolutionSummary ?? null);
  const status = determineReadinessStatus({
    actionableRowCount: args.actionableRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
  });
  const headline = buildHeadline({
    status,
    actionableRowCount: args.actionableRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
  });

  return {
    source: "IMPORT_RESULT",
    status,
    headline: headline.headline,
    supportText: headline.supportText,
    actionableRowCount: args.actionableRowCount,
    invalidRowCount: args.invalidRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
    previewLimited: args.issueSummary.previewLimited,
    checks: buildChecks({
      sheetKind: args.sheetKind,
      actionableRowCount: args.actionableRowCount,
      invalidRowCount: args.invalidRowCount,
      issueSummary: args.issueSummary,
      headerStats,
      codeStats,
    }),
    topConcerns: topConcerns(args.issueSummary),
  };
}

export function buildEmployeeImportRunReadinessSummary(args: {
  mode: "DRY_RUN" | "APPLY";
  sheetKind: EmployeeImportSheetKind;
  requestedCount: number;
  processedCount: number | null;
  rejectedCount: number | null;
  issueSummary: EmployeeImportIssueSummaryDto;
  headerSummarySnapshot: Record<string, unknown> | null;
  codeResolutionSnapshot: Record<string, unknown> | null;
}): EmployeeImportReadinessSummaryDto | null {
  if (args.mode !== "DRY_RUN") return null;

  const actionableRowCount = Math.max(0, args.processedCount ?? args.requestedCount);
  const invalidRowCount = Math.max(0, args.rejectedCount ?? 0);
  const headerStats = getHeaderStats(args.headerSummarySnapshot);
  const codeStats = getCodeResolutionStats(args.codeResolutionSnapshot);
  const status = determineReadinessStatus({
    actionableRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
  });
  const headline = buildHeadline({
    status,
    actionableRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
  });

  return {
    source: "RUN_DETAIL",
    status,
    headline: headline.headline,
    supportText: headline.supportText,
    actionableRowCount,
    invalidRowCount,
    blockingIssueCount: args.issueSummary.totalErrorCount,
    warningIssueCount: args.issueSummary.totalWarningCount,
    previewLimited: args.issueSummary.previewLimited,
    checks: buildChecks({
      sheetKind: args.sheetKind,
      actionableRowCount,
      invalidRowCount,
      issueSummary: args.issueSummary,
      headerStats,
      codeStats,
    }),
    topConcerns: topConcerns(args.issueSummary),
  };
}
