-- Appel par séance de cours (matière) synchronisé à l'emploi du temps.
-- attendance_sessions : une séance = un appel pour (année, classe, matière,
-- enseignant) à une date + créneau. attendance_records : statut par élève.

CREATE TABLE IF NOT EXISTS "attendance_sessions" (
  "id"               TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "class_id"         TEXT NOT NULL,
  "subject_id"       TEXT NOT NULL,
  "teacher_id"       TEXT NOT NULL,
  "date"             DATE NOT NULL,
  "start_time"       VARCHAR(10),
  "end_time"         VARCHAR(10),
  "timetable_id"     TEXT,
  "session_number"   INTEGER NOT NULL DEFAULT 1,
  "notes"            TEXT,
  "recorded_by"      TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id"           TEXT NOT NULL,
  "session_id"   TEXT NOT NULL,
  "student_id"   TEXT NOT NULL,
  "status"       "AttendanceStatus" NOT NULL,
  "excuse"       TEXT,
  "is_justified" BOOLEAN NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_combo_key"
  ON "attendance_sessions"("academic_year_id", "class_id", "subject_id", "teacher_id", "date", "start_time");
CREATE INDEX IF NOT EXISTS "attendance_sessions_ays_idx"
  ON "attendance_sessions"("academic_year_id", "class_id", "subject_id");
CREATE INDEX IF NOT EXISTS "attendance_sessions_teacher_id_idx"
  ON "attendance_sessions"("teacher_id");
CREATE INDEX IF NOT EXISTS "attendance_sessions_date_idx"
  ON "attendance_sessions"("date");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_session_id_student_id_key"
  ON "attendance_records"("session_id", "student_id");
CREATE INDEX IF NOT EXISTS "attendance_records_student_id_idx"
  ON "attendance_records"("student_id");

-- Foreign keys (attendance_sessions)
DO $$ BEGIN
  ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_recorded_by_fkey"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Foreign keys (attendance_records)
DO $$ BEGIN
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
