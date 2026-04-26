-- AlterEnum
ALTER TYPE "EmployeeImportRunMode" ADD VALUE IF NOT EXISTS 'DRY_RUN';

-- CreateEnum
CREATE TYPE "EmployeeImportRunOutcome" AS ENUM ('CLEAN', 'WARNING', 'BLOCKING', 'PARTIAL');

-- Split technical status from business outcome while preserving existing rows.
CREATE TYPE "EmployeeImportRunStatus_new" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "EmployeeImportRun"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "EmployeeImportRun"
  ALTER COLUMN "status" TYPE "EmployeeImportRunStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'PARTIAL' THEN 'COMPLETED'
      ELSE "status"::text
    END
  )::"EmployeeImportRunStatus_new";

DROP TYPE "EmployeeImportRunStatus";
ALTER TYPE "EmployeeImportRunStatus_new" RENAME TO "EmployeeImportRunStatus";

ALTER TABLE "EmployeeImportRun"
  ALTER COLUMN "status" SET DEFAULT 'RUNNING';

-- Rename existing snapshot columns to their explicit 9.0 names.
ALTER TABLE "EmployeeImportRun" RENAME COLUMN "summary" TO "applySummarySnapshot";
ALTER TABLE "EmployeeImportRun" RENAME COLUMN "warningPreview" TO "warningsPreview";
ALTER TABLE "EmployeeImportRun" RENAME COLUMN "errorPreview" TO "errorsPreview";

-- Add bounded inspection fields.
ALTER TABLE "EmployeeImportRun"
  ADD COLUMN "sheetTitle" VARCHAR(120),
  ADD COLUMN "outcome" "EmployeeImportRunOutcome",
  ADD COLUMN "processedCount" INTEGER,
  ADD COLUMN "warningCount" INTEGER,
  ADD COLUMN "errorCount" INTEGER,
  ADD COLUMN "headerSummarySnapshot" JSONB,
  ADD COLUMN "codeResolutionSnapshot" JSONB;

UPDATE "EmployeeImportRun"
SET
  "sheetTitle" = CASE "sheetKind"
    WHEN 'ALL_FIELDS' THEN 'Tum Basliklar'
    WHEN 'FULL_DATA' THEN 'Tam Toplu Aktarim'
    WHEN 'PERSONAL_DATA' THEN 'Kisisel Veriler'
    WHEN 'ORG_DATA' THEN 'Organizasyon Verileri'
    WHEN 'WORK_DATA' THEN 'Calisma Verileri'
    ELSE "sheetKind"
  END,
  "processedCount" = COALESCE("processedCount", "requestedCount"),
  "warningCount" = COALESCE(
    "warningCount",
    CASE
      WHEN "warningsPreview" IS NULL THEN 0
      WHEN jsonb_typeof("warningsPreview") = 'array' THEN jsonb_array_length("warningsPreview")
      ELSE 0
    END
  ),
  "errorCount" = COALESCE(
    "errorCount",
    CASE
      WHEN "errorsPreview" IS NULL THEN 0
      WHEN jsonb_typeof("errorsPreview") = 'array' THEN jsonb_array_length("errorsPreview")
      ELSE 0
    END
  ),
  "outcome" = CASE
    WHEN "status" = 'FAILED' THEN 'BLOCKING'::"EmployeeImportRunOutcome"
    WHEN COALESCE("rejectedCount", 0) > 0 THEN 'PARTIAL'::"EmployeeImportRunOutcome"
    WHEN "errorsPreview" IS NOT NULL
      AND jsonb_typeof("errorsPreview") = 'array'
      AND jsonb_array_length("errorsPreview") > 0
      THEN 'BLOCKING'::"EmployeeImportRunOutcome"
    WHEN "warningsPreview" IS NOT NULL
      AND jsonb_typeof("warningsPreview") = 'array'
      AND jsonb_array_length("warningsPreview") > 0
      THEN 'WARNING'::"EmployeeImportRunOutcome"
    ELSE 'CLEAN'::"EmployeeImportRunOutcome"
  END;

ALTER TABLE "EmployeeImportRun"
  ALTER COLUMN "sheetTitle" SET NOT NULL;

-- Read-path friendly indexes for 9.0 query/history screens.
CREATE INDEX "EmployeeImportRun_companyId_mode_startedAt_idx"
  ON "EmployeeImportRun"("companyId", "mode", "startedAt");

CREATE INDEX "EmployeeImportRun_companyId_sheetKind_outcome_startedAt_idx"
  ON "EmployeeImportRun"("companyId", "sheetKind", "outcome", "startedAt");
