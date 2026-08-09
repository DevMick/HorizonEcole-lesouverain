-- Store the auto-generated login password for a student's account so it can be
-- displayed in the "Compte" tab of the student profile page. Nullable: students
-- whose account predates this feature (or have no account) simply have no value.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "generated_password" VARCHAR(255);
