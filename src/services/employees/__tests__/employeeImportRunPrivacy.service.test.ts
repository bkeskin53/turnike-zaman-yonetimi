import { describe, expect, it, vi } from "vitest";
import {
  EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
  formatEmployeeImportErrorPreviewPolicyText,
  formatEmployeeImportInspectionLimitText,
  formatEmployeeImportInspectionSummary,
  formatEmployeeImportPreviewPolicyText,
  formatEmployeeImportSnapshotPolicyText,
  getEmployeeImportPreviewEmptyText,
  getEmployeeImportPreviewSectionTitle,
  getEmployeeImportSnapshotLabel,
  maskEmployeeImportIssueValue,
  maskEmployeeImportRunEmail,
  maskEmployeeImportRunIdentifier,
  sanitizeEmployeeImportRunChangedEmployeeCodesPreview,
  sanitizeEmployeeImportRunIssuePreview,
  isEmployeeImportRunPreviewExpired,
  isEmployeeImportRunSnapshotExpired,
} from "../employeeImportRunPrivacy.service";

describe("employeeImportRunPrivacy.service", () => {
  it("masks actor emails while keeping the domain readable", () => {
    expect(maskEmployeeImportRunEmail("ayse.yilmaz@example.com")).toBe("ay*********@example.com");
  });

  it("masks employee identifiers with visible edges", () => {
    expect(maskEmployeeImportRunIdentifier("EMP001")).toBe("EM**01");
  });

  it("masks issue values by sensitive field type", () => {
    expect(maskEmployeeImportIssueValue("email", "ayse.yilmaz@example.com")).toBe("ay*********@example.com");
    expect(maskEmployeeImportIssueValue("phone", "5551234567")).toBe("******4567");
    expect(maskEmployeeImportIssueValue("nationalId", "12345678901")).toBe("*******8901");
  });

  it("sanitizes issue preview payloads", () => {
    expect(
      sanitizeEmployeeImportRunIssuePreview({
        line: 4,
        employeeCode: "EMP001",
        code: "INVALID_EMAIL_FORMAT",
        message: "bad email",
        field: "email",
        value: "ayse.yilmaz@example.com",
      }),
    ).toEqual({
      line: 4,
      employeeCode: "EM**01",
      code: "INVALID_EMAIL_FORMAT",
      message: "bad email",
      field: "email",
      value: "ay*********@example.com",
    });
  });

  it("dedupes and masks changed employee previews", () => {
    expect(
      sanitizeEmployeeImportRunChangedEmployeeCodesPreview(["EMP001", "EMP001", "EMP002"]),
    ).toEqual(["EM**01", "EM**02"]);
  });

  it("caps changed employee preview length", () => {
    const values = Array.from({ length: EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT + 5 }, (_, index) => `EMP${String(index).padStart(3, "0")}`);
    expect(sanitizeEmployeeImportRunChangedEmployeeCodesPreview(values)).toHaveLength(
      EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
    );
  });

  it("expires previews earlier than snapshots", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));

    expect(isEmployeeImportRunPreviewExpired(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isEmployeeImportRunPreviewExpired(new Date("2026-03-01T00:00:00.000Z"))).toBe(false);
    expect(isEmployeeImportRunSnapshotExpired(new Date("2025-09-01T00:00:00.000Z"))).toBe(true);
    expect(isEmployeeImportRunSnapshotExpired(new Date("2026-01-01T00:00:00.000Z"))).toBe(false);

    vi.useRealTimers();
  });

  it("builds aligned inspection policy copy", () => {
    const policy = {
      actorMasked: true,
      previewValuesMasked: true,
      previewRetentionDays: 90,
      snapshotRetentionDays: 180,
      issuePreviewLimit: 50,
      changedEmployeePreviewLimit: 100,
      previewsExpired: false,
      snapshotsExpired: false,
    };

    expect(formatEmployeeImportInspectionSummary(policy)).toContain("maskelenmiş");
    expect(formatEmployeeImportInspectionLimitText(policy)).toContain("ilk 50 kayıt");
    expect(formatEmployeeImportPreviewPolicyText(policy)).toContain("ham kişisel veri");
    expect(formatEmployeeImportErrorPreviewPolicyText(policy)).toContain("alan değeri");
    expect(formatEmployeeImportSnapshotPolicyText(policy)).toContain("180 gün");
  });

  it("returns stable localized labels for preview and snapshot sections", () => {
    expect(getEmployeeImportPreviewSectionTitle("warnings")).toBe("Uyarı Önizlemesi");
    expect(getEmployeeImportPreviewEmptyText("errors")).toBe("Kayıtlı hata önizlemesi yok.");
    expect(getEmployeeImportSnapshotLabel("applySummary")).toBe("Uygulama Özeti");
  });
});
