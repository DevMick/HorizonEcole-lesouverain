-- CreateTable
-- Create evaluation_types table
CREATE TABLE IF NOT EXISTS "evaluation_types" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evaluation_types_teacher_id_idx" ON "evaluation_types"("teacher_id");

-- AddForeignKey
ALTER TABLE "evaluation_types" ADD CONSTRAINT "evaluation_types_teacher_id_fkey" 
FOREIGN KEY ("teacher_id") 
REFERENCES "teachers"("id") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

