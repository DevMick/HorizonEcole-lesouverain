-- CreateTable
CREATE TABLE IF NOT EXISTS "student_parents" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "relation" "ParentRelation" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_parents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "student_parents_student_id_parent_id_key" ON "student_parents"("student_id", "parent_id");

-- AddForeignKey (only if table doesn't exist or constraint doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_parents_student_id_fkey'
    ) THEN
        ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_fkey" 
        FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_parents_parent_id_fkey'
    ) THEN
        ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_id_fkey" 
        FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

