-- CreateEnum
CREATE TYPE "IntegrationLogStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "IntegrationEmployeeLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceSystem" VARCHAR(50) NOT NULL,
    "externalRef" VARCHAR(200) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastPayloadHash" VARCHAR(64),

    CONSTRAINT "IntegrationEmployeeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" VARCHAR(64) NOT NULL,
    "endpoint" VARCHAR(200) NOT NULL,
    "sourceSystem" VARCHAR(50) NOT NULL,
    "batchRef" VARCHAR(200),
    "ip" VARCHAR(64),
    "apiKeyHash" VARCHAR(64),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "IntegrationLogStatus" NOT NULL DEFAULT 'SUCCESS',
    "errors" JSONB,
    "payloadMeta" JSONB,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationEmployeeLink_companyId_employeeId_idx" ON "IntegrationEmployeeLink"("companyId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEmployeeLink_companyId_sourceSystem_externalRef_key" ON "IntegrationEmployeeLink"("companyId", "sourceSystem", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationLog_requestId_key" ON "IntegrationLog"("requestId");

-- CreateIndex
CREATE INDEX "IntegrationLog_companyId_sourceSystem_receivedAt_idx" ON "IntegrationLog"("companyId", "sourceSystem", "receivedAt");

-- AddForeignKey
ALTER TABLE "IntegrationEmployeeLink" ADD CONSTRAINT "IntegrationEmployeeLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEmployeeLink" ADD CONSTRAINT "IntegrationEmployeeLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
