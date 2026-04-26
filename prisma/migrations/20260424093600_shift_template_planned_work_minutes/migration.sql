-- STW-1.1 — Shift Template Schema & Reset-Friendly Migration
-- Reset-friendly canonical duration column. Existing test data is intentionally
-- not backfilled because this patch chain is applied after prisma migrate reset.
ALTER TABLE "ShiftTemplate"
ADD COLUMN "plannedWorkMinutes" INTEGER NOT NULL DEFAULT 0;