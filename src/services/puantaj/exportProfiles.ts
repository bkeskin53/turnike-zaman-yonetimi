export type PuantajExportProfile =
  | "STANDARD_MONTHLY"
  | "STANDARD_DAILY"
  | "PAYROLL_CODE_SUMMARY";

const MONTHLY_PROFILES: PuantajExportProfile[] = [
  "STANDARD_MONTHLY",
  "PAYROLL_CODE_SUMMARY",
];

const DAILY_PROFILES: PuantajExportProfile[] = [
  "STANDARD_DAILY",
];

export function isPuantajExportProfile(value: string | null | undefined): value is PuantajExportProfile {
  return value === "STANDARD_MONTHLY" || value === "STANDARD_DAILY" || value === "PAYROLL_CODE_SUMMARY";
}

export function getMonthlyExportProfile(value: string | null | undefined): PuantajExportProfile {
  if (!value) return "STANDARD_MONTHLY";
  if (!isPuantajExportProfile(value)) {
    throw new Error("BAD_PROFILE");
  }
  if (!MONTHLY_PROFILES.includes(value)) {
    throw new Error("BAD_PROFILE");
  }
  return value;
}

export function getDailyExportProfile(value: string | null | undefined): PuantajExportProfile {
  if (!value) return "STANDARD_DAILY";
  if (!isPuantajExportProfile(value)) {
    throw new Error("BAD_PROFILE");
  }
  if (!DAILY_PROFILES.includes(value)) {
    throw new Error("BAD_PROFILE");
  }
  return value;
}

export function getMonthlyExportProfileLabel(profile: PuantajExportProfile): string {
  switch (profile) {
    case "STANDARD_MONTHLY":
      return "Standard Monthly Summary";
    case "PAYROLL_CODE_SUMMARY":
      return "Payroll Code Summary";
    case "STANDARD_DAILY":
      return "Standard Daily";
  }
}

export function getDailyExportProfileLabel(profile: PuantajExportProfile): string {
  switch (profile) {
    case "STANDARD_DAILY":
      return "Standard Daily";
    case "STANDARD_MONTHLY":
      return "Standard Monthly Summary";
    case "PAYROLL_CODE_SUMMARY":
      return "Payroll Code Summary";
  }
}