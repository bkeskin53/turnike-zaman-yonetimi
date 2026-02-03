-- CreateTable
CREATE TABLE "IntegrationSecurityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "reason" VARCHAR(50) NOT NULL,
    "endpoint" VARCHAR(200) NOT NULL,
    "sourceIp" VARCHAR(64),
    "userAgent" VARCHAR(200),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "IntegrationSecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationSecurityLog_companyId_idx" ON "IntegrationSecurityLog"("companyId");

-- CreateIndex
CREATE INDEX "IntegrationSecurityLog_reason_idx" ON "IntegrationSecurityLog"("reason");

-- CreateIndex
CREATE INDEX "IntegrationSecurityLog_receivedAt_idx" ON "IntegrationSecurityLog"("receivedAt");

-- AddForeignKey
ALTER TABLE "IntegrationSecurityLog" ADD CONSTRAINT "IntegrationSecurityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
