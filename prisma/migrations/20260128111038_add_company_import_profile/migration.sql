-- CreateEnum
CREATE TYPE "ImportProfileKind" AS ENUM ('EMPLOYEES');

-- CreateTable
CREATE TABLE "CompanyImportProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "ImportProfileKind" NOT NULL,
    "mapping" JSONB NOT NULL,

    CONSTRAINT "CompanyImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyImportProfile_companyId_idx" ON "CompanyImportProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyImportProfile_companyId_kind_key" ON "CompanyImportProfile"("companyId", "kind");

-- AddForeignKey
ALTER TABLE "CompanyImportProfile" ADD CONSTRAINT "CompanyImportProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
