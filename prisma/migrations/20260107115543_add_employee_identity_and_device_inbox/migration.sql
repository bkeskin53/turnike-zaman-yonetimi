-- CreateEnum
CREATE TYPE "ExitExceedAction" AS ENUM ('IGNORE', 'WARN', 'FLAG');

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "exitConsumesBreak" BOOLEAN,
ADD COLUMN     "exitExceedAction" "ExitExceedAction",
ADD COLUMN     "graceAffectsWorked" BOOLEAN,
ADD COLUMN     "maxDailyExitMinutes" INTEGER,
ADD COLUMN     "maxSingleExitMinutes" INTEGER;
