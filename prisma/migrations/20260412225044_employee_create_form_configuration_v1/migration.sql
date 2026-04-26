-- CreateEnum
CREATE TYPE "ScreenConfigurationScreenKey" AS ENUM ('employees.create');

-- CreateEnum
CREATE TYPE "ScreenConfigurationFieldKey" AS ENUM ('gender', 'email', 'phone', 'cardNo', 'deviceUserId');

-- CreateTable
CREATE TABLE "ScreenConfigurationProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "screenKey" "ScreenConfigurationScreenKey" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScreenConfigurationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenConfigurationField" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fieldKey" "ScreenConfigurationFieldKey" NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScreenConfigurationField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenConfigurationProfile_companyId_idx" ON "ScreenConfigurationProfile"("companyId");

-- CreateIndex
CREATE INDEX "ScreenConfigurationProfile_screenKey_idx" ON "ScreenConfigurationProfile"("screenKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenConfigurationProfile_companyId_screenKey_key" ON "ScreenConfigurationProfile"("companyId", "screenKey");

-- CreateIndex
CREATE INDEX "ScreenConfigurationField_profileId_idx" ON "ScreenConfigurationField"("profileId");

-- CreateIndex
CREATE INDEX "ScreenConfigurationField_fieldKey_idx" ON "ScreenConfigurationField"("fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenConfigurationField_profileId_fieldKey_key" ON "ScreenConfigurationField"("profileId", "fieldKey");

-- AddForeignKey
ALTER TABLE "ScreenConfigurationProfile" ADD CONSTRAINT "ScreenConfigurationProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenConfigurationField" ADD CONSTRAINT "ScreenConfigurationField_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ScreenConfigurationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
