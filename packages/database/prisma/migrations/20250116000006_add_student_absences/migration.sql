-- CreateTable
CREATE TABLE IF NOT EXISTS "student_absences" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "hours_absent" DECIMAL(3, 1) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_academic_year_id_idx" ON "student_absences"("academic_year_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_student_id_idx" ON "student_absences"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_semester_id_idx" ON "student_absences"("semester_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_subject_id_idx" ON "student_absences"("subject_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_teacher_id_idx" ON "student_absences"("teacher_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_date_idx" ON "student_absences"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_academic_year_id_teacher_id_subject_id_date_idx" ON "student_absences"("academic_year_id", "teacher_id", "subject_id", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_absences_academic_year_id_fkey'
    ) THEN
        ALTER TABLE "student_absences" 
        ADD CONSTRAINT "student_absences_academic_year_id_fkey" 
        FOREIGN KEY ("academic_year_id") 
        REFERENCES "academic_years"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_absences_student_id_fkey'
    ) THEN
        ALTER TABLE "student_absences" 
        ADD CONSTRAINT "student_absences_student_id_fkey" 
        FOREIGN KEY ("student_id") 
        REFERENCES "students"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_absences_semester_id_fkey'
    ) THEN
        ALTER TABLE "student_absences" 
        ADD CONSTRAINT "student_absences_semester_id_fkey" 
        FOREIGN KEY ("semester_id") 
        REFERENCES "semesters"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_absences_subject_id_fkey'
    ) THEN
        ALTER TABLE "student_absences" 
        ADD CONSTRAINT "student_absences_subject_id_fkey" 
        FOREIGN KEY ("subject_id") 
        REFERENCES "subjects"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_absences_teacher_id_fkey'
    ) THEN
        ALTER TABLE "student_absences" 
        ADD CONSTRAINT "student_absences_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

