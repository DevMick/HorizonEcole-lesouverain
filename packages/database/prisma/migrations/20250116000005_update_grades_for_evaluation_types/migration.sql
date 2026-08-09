-- AlterTable
-- Add evaluation_type_id column to grades table (nullable first)
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "evaluation_type_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grades_evaluation_type_id_idx" ON "grades"("evaluation_type_id");

-- Create a default evaluation type for each teacher and migrate existing data
-- First, create default evaluation types for all teachers
DO $$
DECLARE
    teacher_record RECORD;
    default_eval_type_id TEXT;
BEGIN
    FOR teacher_record IN SELECT DISTINCT "teacher_id" FROM "grades" WHERE "evaluation_type_id" IS NULL
    LOOP
        -- Generate UUID for the default evaluation type
        default_eval_type_id := gen_random_uuid()::TEXT;
        
        -- Create a default evaluation type "Note" for this teacher
        INSERT INTO "evaluation_types" ("id", "name", "teacher_id", "created_at", "updated_at")
        VALUES (
            default_eval_type_id,
            'Note',
            teacher_record.teacher_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT DO NOTHING;
        
        -- Update all grades for this teacher to use the default evaluation type
        UPDATE "grades"
        SET "evaluation_type_id" = default_eval_type_id
        WHERE "teacher_id" = teacher_record.teacher_id 
        AND "evaluation_type_id" IS NULL;
    END LOOP;
END $$;

-- AddForeignKey constraint
-- Only add if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'grades_evaluation_type_id_fkey'
    ) THEN
        ALTER TABLE "grades" 
        ADD CONSTRAINT "grades_evaluation_type_id_fkey" 
        FOREIGN KEY ("evaluation_type_id") 
        REFERENCES "evaluation_types"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Make evaluation_type_id NOT NULL only if all existing rows have been updated
-- This ensures we don't break existing data
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "grades" WHERE "evaluation_type_id" IS NULL;
    
    IF null_count = 0 THEN
        ALTER TABLE "grades" ALTER COLUMN "evaluation_type_id" SET NOT NULL;
    ELSE
        RAISE NOTICE 'Warning: % grades have NULL evaluation_type_id. Column remains nullable.', null_count;
    END IF;
END $$;

-- Remove the name column after migration (only if evaluation_type_id is NOT NULL)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "grades" WHERE "evaluation_type_id" IS NULL;
    
    IF null_count = 0 THEN
        -- All data migrated, safe to remove name column
        ALTER TABLE "grades" DROP COLUMN IF EXISTS "name";
    ELSE
        RAISE NOTICE 'Warning: Keeping name column because % grades have NULL evaluation_type_id.', null_count;
    END IF;
END $$;

