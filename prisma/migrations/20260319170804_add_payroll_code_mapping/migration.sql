-- CreateEnum
CREATE TYPE "PayrollCodeMappingItemUnit" AS ENUM ('MINUTES', 'DAYS');

-- CreateTable
CREATE TABLE "PayrollCodeMappingProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollCodeMappingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCodeMappingItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "puantajCode" VARCHAR(50) NOT NULL,
    "payrollCode" VARCHAR(50) NOT NULL,
    "payrollLabel" VARCHAR(200) NOT NULL,
    "unit" "PayrollCodeMappingItemUnit" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollCodeMappingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollCodeMappingProfile_companyId_isDefault_idx" ON "PayrollCodeMappingProfile"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "PayrollCodeMappingProfile_companyId_isActive_idx" ON "PayrollCodeMappingProfile"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "PayrollCodeMappingProfile_companyId_createdAt_idx" ON "PayrollCodeMappingProfile"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCodeMappingProfile_companyId_code_key" ON "PayrollCodeMappingProfile"("companyId", "code");

-- CreateIndex
CREATE INDEX "PayrollCodeMappingItem_profileId_isActive_sortOrder_idx" ON "PayrollCodeMappingItem"("profileId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PayrollCodeMappingItem_profileId_payrollCode_idx" ON "PayrollCodeMappingItem"("profileId", "payrollCode");

-- CreateIndex
CREATE INDEX "PayrollCodeMappingItem_profileId_puantajCode_isActive_idx" ON "PayrollCodeMappingItem"("profileId", "puantajCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCodeMappingItem_profileId_puantajCode_key" ON "PayrollCodeMappingItem"("profileId", "puantajCode");

-- AddForeignKey
ALTER TABLE "PayrollCodeMappingProfile" ADD CONSTRAINT "PayrollCodeMappingProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCodeMappingItem" ADD CONSTRAINT "PayrollCodeMappingItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PayrollCodeMappingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
