-- Redesign: students carry their own state-assignment flag and attachments,
-- inscriptions become a lightweight link between an existing student, a class
-- and an academic year (instead of duplicating student/parent data).

-- 1) New fields on students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "is_state_assigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';

-- 2) Reset existing inscriptions test data (agreed with product owner - dev data only)
DELETE FROM "inscriptions";

-- 3) Drop the old duplicated columns
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "student_first_name";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "student_last_name";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "student_gender";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "student_date_of_birth";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "student_birth_place";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "attachments";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "parent_first_name";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "parent_last_name";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "parent_contact";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "residence_location";
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "is_state_assigned";

-- 4) Add the student link
ALTER TABLE "inscriptions" ADD COLUMN "student_id" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE;

-- 5) Indexes / constraints
CREATE UNIQUE INDEX IF NOT EXISTS "inscriptions_student_id_academic_year_id_key" ON "inscriptions"("student_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "inscriptions_student_id_idx" ON "inscriptions"("student_id");
