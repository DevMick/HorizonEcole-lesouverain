-- AlterTable: Add user_id column to teachers table (optional, no data loss)
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- CreateIndex: Add index on user_id for better query performance
CREATE INDEX IF NOT EXISTS "teachers_user_id_idx" ON "teachers"("user_id");

-- AddForeignKey: Link teachers to users (onDelete: SetNull to preserve data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'teachers_user_id_fkey'
  ) THEN
    ALTER TABLE "teachers" 
    ADD CONSTRAINT "teachers_user_id_fkey" 
    FOREIGN KEY ("user_id") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- AddUniqueConstraint: Ensure one-to-one relationship (optional constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'teachers_user_id_key'
  ) THEN
    ALTER TABLE "teachers" 
    ADD CONSTRAINT "teachers_user_id_key" 
    UNIQUE ("user_id");
  END IF;
END $$;

