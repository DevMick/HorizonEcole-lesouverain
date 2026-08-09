-- Créneaux horaires réutilisables pour le formulaire d'ajout de l'emploi du temps
CREATE TABLE IF NOT EXISTS "horaires" (
  "id" TEXT NOT NULL,
  "start_time" VARCHAR(10) NOT NULL,
  "end_time" VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "horaires_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "horaires_start_time_end_time_key" ON "horaires"("start_time", "end_time");
