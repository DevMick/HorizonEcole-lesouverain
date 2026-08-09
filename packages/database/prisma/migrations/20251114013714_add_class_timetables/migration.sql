-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateTable
CREATE TABLE "class_timetables" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_timetables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_timetables_academic_year_id_idx" ON "class_timetables"("academic_year_id");

-- CreateIndex
CREATE INDEX "class_timetables_class_id_idx" ON "class_timetables"("class_id");

-- CreateIndex
CREATE INDEX "class_timetables_day_of_week_idx" ON "class_timetables"("day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "class_timetables_academic_year_id_class_id_day_of_week_start_time_key" ON "class_timetables"("academic_year_id", "class_id", "day_of_week", "start_time");

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_timetables" ADD CONSTRAINT "class_timetables_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
