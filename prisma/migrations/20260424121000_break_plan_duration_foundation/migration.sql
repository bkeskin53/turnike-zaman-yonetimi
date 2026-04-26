-- BRK-1.0 — Break Plan Duration Domain & Schema Foundation
-- Mola planı saat aralığı değil, toplam mola süresi master data'sıdır.

CREATE TABLE "BreakPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "plannedBreakMinutes" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BreakPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BreakPlan_companyId_code_key" ON "BreakPlan"("companyId", "code");

CREATE INDEX "BreakPlan_companyId_idx" ON "BreakPlan"("companyId");

CREATE INDEX "BreakPlan_companyId_isActive_idx" ON "BreakPlan"("companyId", "isActive");

ALTER TABLE "BreakPlan"
ADD CONSTRAINT "BreakPlan_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;