-- CreateTable
CREATE TABLE "budget_transactions" (
    "id" TEXT NOT NULL,
    "budget_line_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT,
    "reference" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "budget_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_transactions_budget_line_id_idx" ON "budget_transactions"("budget_line_id");

-- CreateIndex
CREATE INDEX "budget_transactions_transaction_date_idx" ON "budget_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "budget_transactions_created_by_idx" ON "budget_transactions"("created_by");

-- AddForeignKey
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_budget_line_id_fkey" FOREIGN KEY ("budget_line_id") REFERENCES "budget_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

