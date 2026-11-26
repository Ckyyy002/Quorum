-- Kesekjenan become Admin-defined: the code is free text and the three fixed Sekjen Bidang positions
-- become one SEKJEN_BIDANG that points at its kesekjenan. Written by hand so existing rows are converted.
-- One transaction: a failure halfway leaves the database as it was.
BEGIN;

-- 1. Kesekjenan.code: enum → text (values kept).
ALTER TABLE "Kesekjenan" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;
DROP TYPE "KesekjenanCode";

-- 2. Membership.kesekjenanId, filled for existing Sekjen Bidang from the old position name.
ALTER TABLE "Membership" ADD COLUMN "kesekjenanId" TEXT;
UPDATE "Membership" m SET "kesekjenanId" = k."id"
  FROM "Kesekjenan" k
  WHERE k."periodId" = m."periodId"
    AND m."position"::TEXT IN ('SEKJEN_PENGEMBANGAN', 'SEKJEN_RELASI', 'SEKJEN_PERSONALIA')
    AND m."position"::TEXT = 'SEKJEN_' || k."code";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_kesekjenanId_fkey" FOREIGN KEY ("kesekjenanId") REFERENCES "Kesekjenan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Position enum: every seat index compares "position" with a literal of the old type, so they are
--    dropped before the swap and recreated after it.
DROP INDEX "Membership_period_seat_key";
DROP INDEX "Membership_department_seat_key";
DROP INDEX "Membership_biro_seat_key";
DROP INDEX "Membership_coverage_key";
ALTER TYPE "Position" RENAME TO "Position_old";
CREATE TYPE "Position" AS ENUM ('KETUA', 'SEKJEN_BIDANG', 'SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2', 'SEKJEN_KEUANGAN_1', 'SEKJEN_KEUANGAN_2', 'KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN', 'KEPALA_BIRO', 'WAKIL_KEPALA_BIRO', 'ASISTEN_BIRO', 'STAFF');
ALTER TABLE "Membership" ALTER COLUMN "position" TYPE "Position" USING (
  CASE WHEN "position"::TEXT LIKE 'SEKJEN\_%' AND "kesekjenanId" IS NOT NULL THEN 'SEKJEN_BIDANG'
       ELSE "position"::TEXT END
)::"Position";
-- ApprovalLog is empty until US-5, so its column only needs the new type.
ALTER TABLE "ApprovalLog" ALTER COLUMN "actorPosition" TYPE "Position" USING "actorPosition"::TEXT::"Position";
DROP TYPE "Position_old";

-- 4. Seats (US-2.3 AC3): Ketua and each Sekjen Adm/Keu once per period; one Sekjen Bidang per kesekjenan.
CREATE UNIQUE INDEX "Membership_period_seat_key" ON "Membership"("periodId", "position")
  WHERE "endedAt" IS NULL AND "position" IN (
    'KETUA', 'SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2', 'SEKJEN_KEUANGAN_1', 'SEKJEN_KEUANGAN_2'
  );
CREATE UNIQUE INDEX "Membership_kesekjenan_seat_key" ON "Membership"("kesekjenanId")
  WHERE "endedAt" IS NULL AND "position" = 'SEKJEN_BIDANG';

-- Unchanged from 20261125084142_membership_seats, recreated for the new enum type.
CREATE UNIQUE INDEX "Membership_department_seat_key" ON "Membership"("departmentId", "position")
  WHERE "endedAt" IS NULL AND "position" IN ('KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN');
CREATE UNIQUE INDEX "Membership_biro_seat_key" ON "Membership"("biroId", "position")
  WHERE "endedAt" IS NULL AND "position" IN ('KEPALA_BIRO', 'WAKIL_KEPALA_BIRO');
CREATE UNIQUE INDEX "Membership_coverage_key" ON "Membership"(
    "coversKesekjenanId",
    ("position" IN ('SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2'))
  )
  WHERE "endedAt" IS NULL AND "coversKesekjenanId" IS NOT NULL;

COMMIT;
