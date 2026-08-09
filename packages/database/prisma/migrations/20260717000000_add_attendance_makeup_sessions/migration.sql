-- Rattrapage des séances non tenues (§9.6).
--
-- Une ligne = la décision de l'enseignant sur UNE occurrence manquée, repérée
-- par (créneau, date d'origine) — d'où l'unicité. status :
--   'SCHEDULED' → reprogrammée à makeup_date (horaires éventuellement différents)
--   'DISMISSED' → écartée (« pas de cours ce jour » : férié, vacances)
--
-- Le cas DISMISSED sert de mémoire : sans calendrier de fermeture dans le
-- système, l'occurrence réapparaîtrait sinon indéfiniment comme « à rattraper ».
--
-- Écrit à la main plutôt que via `prisma migrate diff` : le diff embarquait de
-- la dérive préexistante (FK inscriptions_student_id → CASCADE, renommages
-- d'index sur attendance_sessions) sans rapport avec ce changement. Ce script
-- est strictement additif et idempotent.

CREATE TABLE IF NOT EXISTS "attendance_makeup_sessions" (
    "id"            TEXT NOT NULL,
    "timetable_id"  TEXT NOT NULL,
    "original_date" DATE NOT NULL,
    "makeup_date"   DATE,
    "start_time"    VARCHAR(10),
    "end_time"      VARCHAR(10),
    "status"        VARCHAR(20) NOT NULL,
    "reason"        TEXT,
    "created_by"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_makeup_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_makeup_sessions_makeup_date_idx"
    ON "attendance_makeup_sessions"("makeup_date");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_makeup_sessions_timetable_id_original_date_key"
    ON "attendance_makeup_sessions"("timetable_id", "original_date");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_makeup_sessions_timetable_id_fkey'
    ) THEN
        ALTER TABLE "attendance_makeup_sessions"
            ADD CONSTRAINT "attendance_makeup_sessions_timetable_id_fkey"
            FOREIGN KEY ("timetable_id") REFERENCES "class_timetables"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_makeup_sessions_created_by_fkey'
    ) THEN
        ALTER TABLE "attendance_makeup_sessions"
            ADD CONSTRAINT "attendance_makeup_sessions_created_by_fkey"
            FOREIGN KEY ("created_by") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
