-- AlterTable
ALTER TABLE "budget_transactions" 
ADD COLUMN "justificatif_url" VARCHAR(500),
ADD COLUMN "justificatif_filename" VARCHAR(255);

-- DropColumn
ALTER TABLE "budget_transactions" DROP COLUMN "reference";

