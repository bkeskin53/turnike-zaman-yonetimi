-- CreateTable
CREATE TABLE "ShiftImportAlias" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "sourceValueRaw" VARCHAR(120) NOT NULL,
    "normalizedSourceValue" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftImportAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftImportAlias_companyId_idx" ON "ShiftImportAlias"("companyId");

-- CreateIndex
CREATE INDEX "ShiftImportAlias_companyId_shiftTemplateId_idx" ON "ShiftImportAlias"("companyId", "shiftTemplateId");

-- CreateIndex
CREATE INDEX "ShiftImportAlias_companyId_isActive_idx" ON "ShiftImportAlias"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftImportAlias_companyId_normalizedSourceValue_key" ON "ShiftImportAlias"("companyId", "normalizedSourceValue");

-- AddForeignKey
ALTER TABLE "ShiftImportAlias" ADD CONSTRAINT "ShiftImportAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftImportAlias" ADD CONSTRAINT "ShiftImportAlias_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
