-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('DEPENSES', 'REVENUS');

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "BudgetType" NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_lines_academic_year_id_idx" ON "budget_lines"("academic_year_id");

-- CreateIndex
CREATE INDEX "budget_lines_parent_id_idx" ON "budget_lines"("parent_id");

-- CreateIndex
CREATE INDEX "budget_lines_type_idx" ON "budget_lines"("type");

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "budget_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

