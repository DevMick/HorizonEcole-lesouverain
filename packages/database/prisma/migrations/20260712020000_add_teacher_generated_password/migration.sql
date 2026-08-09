-- Store the auto-generated login password for a teacher's account so it can be
-- displayed in the "Compte" tab of the teacher detail page. Nullable: teachers
-- whose account predates this feature (or have no account) simply have no value.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "generated_password" VARCHAR(255);
