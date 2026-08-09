-- Remove status column from inscriptions table
ALTER TABLE "inscriptions" DROP COLUMN IF EXISTS "status";

-- Drop the InscriptionStatus enum if it exists (PostgreSQL doesn't auto-drop enums)
-- Note: This will fail if the enum is still used elsewhere, which is fine since we removed it from the schema
DO $$
BEGIN
    DROP TYPE IF EXISTS "InscriptionStatus";
EXCEPTION
    WHEN OTHERS THEN
        -- Enum might be in use or not exist, ignore error
        NULL;
END $$;

-- Drop index on status if it exists
DROP INDEX IF EXISTS "inscriptions_status_idx";

