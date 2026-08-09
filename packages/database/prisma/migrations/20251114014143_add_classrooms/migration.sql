-- CreateTable
CREATE TABLE IF NOT EXISTS "classrooms" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "classrooms_name_key" ON "classrooms"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classrooms_name_idx" ON "classrooms"("name");
