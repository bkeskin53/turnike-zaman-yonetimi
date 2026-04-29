-- CM-2 — Location Group Domain Foundation
-- Company tekil kalır.
-- LocationGroup, mevcut Company ile Branch/Konum arasına eklenen ara master data'dır.
-- Mevcut Branch kayıtları bozulmasın diye locationGroupId nullable başlar.

CREATE TABLE "LocationGroup" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "LocationGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocationGroup_companyId_code_key"
  ON "LocationGroup"("companyId", "code");

CREATE INDEX "LocationGroup_companyId_idx"
  ON "LocationGroup"("companyId");

CREATE INDEX "LocationGroup_companyId_isActive_idx"
  ON "LocationGroup"("companyId", "isActive");

ALTER TABLE "LocationGroup"
  ADD CONSTRAINT "LocationGroup_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "Branch"
  ADD COLUMN "locationGroupId" TEXT;

CREATE INDEX "Branch_locationGroupId_idx"
  ON "Branch"("locationGroupId");

CREATE INDEX "Branch_companyId_locationGroupId_idx"
  ON "Branch"("companyId", "locationGroupId");

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_locationGroupId_fkey"
  FOREIGN KEY ("locationGroupId")
  REFERENCES "LocationGroup"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;