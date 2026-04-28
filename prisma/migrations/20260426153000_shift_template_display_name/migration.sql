ALTER TABLE "ShiftTemplate"
ADD COLUMN "name" VARCHAR(120);

UPDATE "ShiftTemplate"
SET "name" =
  CASE
    WHEN UPPER(COALESCE("shiftCode", '')) = 'OFF'
      OR UPPER(COALESCE("signature", '')) = 'OFF'
      THEN 'Çalışılmayan Gün'
    ELSE COALESCE(NULLIF(TRIM("shiftCode"), ''), NULLIF(TRIM("signature"), ''), 'Vardiya')
  END
WHERE "name" IS NULL OR TRIM("name") = '';

ALTER TABLE "ShiftTemplate"
ALTER COLUMN "name" SET NOT NULL;