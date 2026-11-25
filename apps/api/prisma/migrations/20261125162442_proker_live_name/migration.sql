-- US-3.1: a proker name is unique within its department (departments are per period).
-- Partial so a soft-deleted proker does not block reusing its name.
CREATE UNIQUE INDEX "Proker_live_department_name_key" ON "Proker"("departmentId", "name") WHERE "deletedAt" IS NULL;
