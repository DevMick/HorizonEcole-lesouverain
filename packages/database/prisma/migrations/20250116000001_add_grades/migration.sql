-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "note" DECIMAL(5,2) NOT NULL,
    "max_note" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grades_academic_year_id_idx" ON "grades"("academic_year_id");

-- CreateIndex
CREATE INDEX "grades_teacher_id_idx" ON "grades"("teacher_id");

-- CreateIndex
CREATE INDEX "grades_subject_id_idx" ON "grades"("subject_id");

-- CreateIndex
CREATE INDEX "grades_semester_id_idx" ON "grades"("semester_id");

-- CreateIndex
CREATE INDEX "grades_student_id_idx" ON "grades"("student_id");

-- CreateIndex
CREATE INDEX "grades_academic_year_id_teacher_id_subject_id_semester_id_idx" ON "grades"("academic_year_id", "teacher_id", "subject_id", "semester_id");

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

