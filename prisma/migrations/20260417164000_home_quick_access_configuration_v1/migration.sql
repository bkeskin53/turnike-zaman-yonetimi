ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONFIGURATION_UPDATED';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'CONFIGURATION';

CREATE TABLE "HomeQuickAccessProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "HomeQuickAccessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeQuickAccessCardSetting" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "cardId" VARCHAR(64) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "HomeQuickAccessCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeQuickAccessProfile_companyId_key"
  ON "HomeQuickAccessProfile"("companyId");

CREATE INDEX "HomeQuickAccessProfile_companyId_idx"
  ON "HomeQuickAccessProfile"("companyId");

CREATE UNIQUE INDEX "HomeQuickAccessCardSetting_profileId_cardId_key"
  ON "HomeQuickAccessCardSetting"("profileId", "cardId");

CREATE UNIQUE INDEX "HomeQuickAccessCardSetting_profileId_sortOrder_key"
  ON "HomeQuickAccessCardSetting"("profileId", "sortOrder");

CREATE INDEX "HomeQuickAccessCardSetting_profileId_idx"
  ON "HomeQuickAccessCardSetting"("profileId");

CREATE INDEX "HomeQuickAccessCardSetting_cardId_idx"
  ON "HomeQuickAccessCardSetting"("cardId");

ALTER TABLE "HomeQuickAccessProfile"
  ADD CONSTRAINT "HomeQuickAccessProfile_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "HomeQuickAccessCardSetting"
  ADD CONSTRAINT "HomeQuickAccessCardSetting_profileId_fkey"
  FOREIGN KEY ("profileId")
  REFERENCES "HomeQuickAccessProfile"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;