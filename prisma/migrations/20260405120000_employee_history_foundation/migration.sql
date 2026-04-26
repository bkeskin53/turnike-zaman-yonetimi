-- CreateTable
CREATE TABLE "EmployeeProfileVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320),
    "nationalId" VARCHAR(11),
    "phone" VARCHAR(30),
    "gender" VARCHAR(20),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "EmployeeProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOrgAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "branchId" TEXT,
    "employeeGroupId" TEXT,
    "employeeSubgroupId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "EmployeeOrgAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeProfileVersion_companyId_employeeId_idx" ON "EmployeeProfileVersion"("companyId", "employeeId");
CREATE INDEX "EmployeeProfileVersion_employeeId_validFrom_idx" ON "EmployeeProfileVersion"("employeeId", "validFrom");
CREATE INDEX "EmployeeProfileVersion_companyId_validFrom_idx" ON "EmployeeProfileVersion"("companyId", "validFrom");

-- CreateIndex
CREATE INDEX "EmployeeOrgAssignment_companyId_employeeId_idx" ON "EmployeeOrgAssignment"("companyId", "employeeId");
CREATE INDEX "EmployeeOrgAssignment_employeeId_validFrom_idx" ON "EmployeeOrgAssignment"("employeeId", "validFrom");
CREATE INDEX "EmployeeOrgAssignment_companyId_validFrom_idx" ON "EmployeeOrgAssignment"("companyId", "validFrom");
CREATE INDEX "EmployeeOrgAssignment_companyId_branchId_idx" ON "EmployeeOrgAssignment"("companyId", "branchId");
CREATE INDEX "EmployeeOrgAssignment_companyId_employeeGroupId_idx" ON "EmployeeOrgAssignment"("companyId", "employeeGroupId");
CREATE INDEX "EmployeeOrgAssignment_companyId_employeeSubgroupId_idx" ON "EmployeeOrgAssignment"("companyId", "employeeSubgroupId");

-- AddForeignKey
ALTER TABLE "EmployeeProfileVersion"
ADD CONSTRAINT "EmployeeProfileVersion_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfileVersion"
ADD CONSTRAINT "EmployeeProfileVersion_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOrgAssignment"
ADD CONSTRAINT "EmployeeOrgAssignment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeOrgAssignment"
ADD CONSTRAINT "EmployeeOrgAssignment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeOrgAssignment"
ADD CONSTRAINT "EmployeeOrgAssignment_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOrgAssignment"
ADD CONSTRAINT "EmployeeOrgAssignment_employeeGroupId_fkey"
FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeOrgAssignment"
ADD CONSTRAINT "EmployeeOrgAssignment_employeeSubgroupId_fkey"
FOREIGN KEY ("employeeSubgroupId") REFERENCES "EmployeeSubgroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;