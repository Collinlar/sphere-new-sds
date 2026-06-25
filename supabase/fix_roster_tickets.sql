-- Corrective migration: rosters/exam_tickets tables pre-existed from an earlier
-- partial run, so CREATE TABLE IF NOT EXISTS in schema.sql skipped them and they
-- never picked up invite_code / the exam_session_id rename. Run this once in the
-- Supabase SQL editor to bring them in line with the current schema.sql.

ALTER TABLE rosters ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

ALTER TABLE exam_tickets ADD COLUMN IF NOT EXISTS exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE;
ALTER TABLE exam_tickets DROP COLUMN IF EXISTS exam_id;

CREATE INDEX IF NOT EXISTS idx_exam_tickets_session ON exam_tickets(exam_session_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_tickets_session_user_unique'
  ) THEN
    ALTER TABLE exam_tickets ADD CONSTRAINT exam_tickets_session_user_unique UNIQUE (exam_session_id, user_id);
  END IF;
END $$;

-- These three tables were created after a Supabase project setting started
-- auto-enabling RLS on new tables with no policies attached, which silently
-- blocks every insert. No other table in this schema uses RLS — the app
-- authorizes at the application layer (institution_id / role checks), not
-- via Postgres policies — so disable it here to match the rest of the schema.
ALTER TABLE rosters DISABLE ROW LEVEL SECURITY;
ALTER TABLE roster_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_tickets DISABLE ROW LEVEL SECURITY;

-- Phase 5: let a course be tied to a roster for bulk enrollment.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS roster_id UUID REFERENCES rosters(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS audience_groups TEXT[];
