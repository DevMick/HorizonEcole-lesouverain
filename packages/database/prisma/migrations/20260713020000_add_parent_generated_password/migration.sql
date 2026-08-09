-- Store the auto-generated login password for a parent's account so it can be
-- displayed in the "Compte" card of the parent profile page. Nullable: parents
-- whose account predates this feature (or have no account) simply have no value.
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "generated_password" VARCHAR(255);
