-- CreateTable: Create student_payments table
CREATE TABLE "student_payments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "school_fee_rate_detail_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expected_amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "receipt_number" VARCHAR(50),
    "reference" VARCHAR(100),
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_payments_student_id_idx" ON "student_payments"("student_id");
CREATE INDEX "student_payments_academic_year_id_idx" ON "student_payments"("academic_year_id");
CREATE INDEX "student_payments_school_fee_rate_detail_id_idx" ON "student_payments"("school_fee_rate_detail_id");
CREATE INDEX "student_payments_payment_date_idx" ON "student_payments"("payment_date");
CREATE INDEX "student_payments_status_idx" ON "student_payments"("status");
CREATE INDEX "student_payments_student_id_academic_year_id_idx" ON "student_payments"("student_id", "academic_year_id");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "student_payments_receipt_number_key" ON "student_payments"("receipt_number") WHERE "receipt_number" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_school_fee_rate_detail_id_fkey" FOREIGN KEY ("school_fee_rate_detail_id") REFERENCES "school_fee_rate_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

