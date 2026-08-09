-- CreateTable
CREATE TABLE "class_main_teachers" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_main_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_main_teachers_teacher_id_academic_year_id_key" ON "class_main_teachers"("teacher_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_main_teachers_class_id_academic_year_id_key" ON "class_main_teachers"("class_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "class_main_teachers_academic_year_id_idx" ON "class_main_teachers"("academic_year_id");

-- CreateIndex
CREATE INDEX "class_main_teachers_teacher_id_idx" ON "class_main_teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "class_main_teachers_class_id_idx" ON "class_main_teachers"("class_id");

-- AddForeignKey
ALTER TABLE "class_main_teachers" ADD CONSTRAINT "class_main_teachers_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_main_teachers" ADD CONSTRAINT "class_main_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_main_teachers" ADD CONSTRAINT "class_main_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

