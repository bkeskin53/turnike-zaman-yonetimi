-- BRK-1.3 — Shift Template Break Plan Binding
-- Mola planı vardiya şablonuna opsiyonel master-data bağlantısı olarak bağlanır.
-- Expected-work düşümü BRK-1.4 içinde yapılacaktır.

ALTER TABLE "ShiftTemplate"
ADD COLUMN "breakPlanId" TEXT;

CREATE INDEX "ShiftTemplate_companyId_breakPlanId_idx"
ON "ShiftTemplate"("companyId", "breakPlanId");

ALTER TABLE "ShiftTemplate"
ADD CONSTRAINT "ShiftTemplate_breakPlanId_fkey"
FOREIGN KEY ("breakPlanId") REFERENCES "BreakPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;