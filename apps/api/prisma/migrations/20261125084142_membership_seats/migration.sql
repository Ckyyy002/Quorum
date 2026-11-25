-- Single-seat positions (US-2.3 AC3), enforced by the database so two concurrent assignments cannot both win.
-- Only active (not ended) memberships count. Prisma cannot express partial indexes, so they live here.

-- KETUA and every SEKJEN_*: one holder per period.
CREATE UNIQUE INDEX "Membership_period_seat_key" ON "Membership"("periodId", "position")
  WHERE "endedAt" IS NULL AND "position" IN (
    'KETUA', 'SEKJEN_PENGEMBANGAN', 'SEKJEN_RELASI', 'SEKJEN_PERSONALIA',
    'SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2', 'SEKJEN_KEUANGAN_1', 'SEKJEN_KEUANGAN_2'
  );

-- Kepala and Sekretaris Departemen: one each per department.
CREATE UNIQUE INDEX "Membership_department_seat_key" ON "Membership"("departmentId", "position")
  WHERE "endedAt" IS NULL AND "position" IN ('KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN');

-- Kepala and Wakil Kepala Biro: one each per biro.
CREATE UNIQUE INDEX "Membership_biro_seat_key" ON "Membership"("biroId", "position")
  WHERE "endedAt" IS NULL AND "position" IN ('KEPALA_BIRO', 'WAKIL_KEPALA_BIRO');

-- One Sekjen Administrasi and one Sekjen Keuangan per covered kesekjenan. The boolean expression groups
-- _1/_2 together: true = administrasi, false = keuangan.
CREATE UNIQUE INDEX "Membership_coverage_key" ON "Membership"(
    "coversKesekjenanId",
    ("position" IN ('SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2'))
  )
  WHERE "endedAt" IS NULL AND "coversKesekjenanId" IS NOT NULL;
