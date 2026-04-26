-- CreateEnum
CREATE TYPE "EmployeeImportRunMode" AS ENUM ('APPLY');

-- CreateEnum
CREATE TYPE "EmployeeImportRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "EmployeeImportRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sheetKind" VARCHAR(32) NOT NULL,
    "mode" "EmployeeImportRunMode" NOT NULL DEFAULT 'APPLY',
    "status" "EmployeeImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "contentHash" VARCHAR(64) NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "foundCount" INTEGER,
    "changedCount" INTEGER,
    "unchangedCount" INTEGER,
    "rejectedCount" INTEGER,
    "summary" JSONB,
    "changedEmployeeCodesPreview" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "warningPreview" JSONB,
    "errorPreview" JSONB,
    "duplicateOfRunId" TEXT,
    "failedCode" VARCHAR(100),
    "failedMessage" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    CONSTRAINT "EmployeeImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeImportApplyLock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sheetKind" VARCHAR(32) NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeImportApplyLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeImportRun_companyId_sheetKind_startedAt_idx" ON "EmployeeImportRun"("companyId", "sheetKind", "startedAt");
CREATE INDEX "EmployeeImportRun_companyId_sheetKind_status_startedAt_idx" ON "EmployeeImportRun"("companyId", "sheetKind", "status", "startedAt");
CREATE INDEX "EmployeeImportRun_companyId_sheetKind_contentHash_startedAt_idx" ON "EmployeeImportRun"("companyId", "sheetKind", "contentHash", "startedAt");
CREATE INDEX "EmployeeImportRun_actorUserId_idx" ON "EmployeeImportRun"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeImportApplyLock_companyId_sheetKind_key" ON "EmployeeImportApplyLock"("companyId", "sheetKind");
CREATE INDEX "EmployeeImportApplyLock_acquiredAt_idx" ON "EmployeeImportApplyLock"("acquiredAt");

-- AddForeignKey
ALTER TABLE "EmployeeImportRun"
ADD CONSTRAINT "EmployeeImportRun_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeImportRun"
ADD CONSTRAINT "EmployeeImportRun_duplicateOfRunId_fkey"
FOREIGN KEY ("duplicateOfRunId") REFERENCES "EmployeeImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeImportApplyLock"
ADD CONSTRAINT "EmployeeImportApplyLock_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
