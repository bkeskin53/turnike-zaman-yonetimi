-- 1) Rename existing enum values (preserve existing rows)
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN' TO 'SYSTEM_ADMIN';
ALTER TYPE "UserRole" RENAME VALUE 'HR' TO 'HR_OPERATOR';
ALTER TYPE "UserRole" RENAME VALUE 'USER' TO 'SUPERVISOR';

-- 2) Add the missing enum value (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'HR_CONFIG_ADMIN'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'HR_CONFIG_ADMIN';
  END IF;
END$$;

-- 3) Create UserDataScope enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserDataScope') THEN
    CREATE TYPE "UserDataScope" AS ENUM ('ALL', 'BRANCH', 'EMPLOYEE_GROUP', 'EMPLOYEE_SUBGROUP');
  END IF;
END$$;

-- 4) Add scope columns to User
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HR_OPERATOR';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dataScope" "UserDataScope" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "scopeBranchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "scopeEmployeeGroupIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "scopeEmployeeSubgroupIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 5) Index
CREATE INDEX IF NOT EXISTS "User_dataScope_idx" ON "User"("dataScope");
