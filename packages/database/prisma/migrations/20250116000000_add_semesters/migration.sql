-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semesters_academic_year_id_idx" ON "semesters"("academic_year_id");

-- CreateIndex
CREATE INDEX "semesters_start_date_idx" ON "semesters"("start_date");

-- CreateIndex
CREATE INDEX "semesters_end_date_idx" ON "semesters"("end_date");

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

