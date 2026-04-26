ALTER TABLE "EmployeeProfileVersion"
  ADD COLUMN "employeeCode" VARCHAR(50),
  ADD COLUMN "cardNo" VARCHAR(100);

UPDATE "EmployeeProfileVersion" ep
SET
  "employeeCode" = e."employeeCode",
  "cardNo" = e."cardNo"
FROM "Employee" e
WHERE e."id" = ep."employeeId"
  AND e."companyId" = ep."companyId";

ALTER TABLE "EmployeeProfileVersion"
  ALTER COLUMN "employeeCode" SET NOT NULL;