-- Remove academic_year_id from school_fee_rates table

-- Drop the unique constraint that includes academic_year_id
ALTER TABLE "school_fee_rates" DROP CONSTRAINT IF EXISTS "school_fee_rates_academic_year_id_class_id_is_for_state_assigned_key";

-- Drop the index on academic_year_id
DROP INDEX IF EXISTS "school_fee_rates_academic_year_id_idx";

-- Drop the foreign key constraint
ALTER TABLE "school_fee_rates" DROP CONSTRAINT IF EXISTS "school_fee_rates_academic_year_id_fkey";

-- Drop the column
ALTER TABLE "school_fee_rates" DROP COLUMN IF EXISTS "academic_year_id";

-- Create new unique constraint without academic_year_id
ALTER TABLE "school_fee_rates" ADD CONSTRAINT "school_fee_rates_class_id_is_for_state_assigned_key" UNIQUE ("class_id", "is_for_state_assigned");

