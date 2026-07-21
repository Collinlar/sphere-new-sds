-- Question bank + invigilator / reconnect support for Assess
CREATE TABLE IF NOT EXISTS bank_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT,
  topic TEXT,
  difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('foundation', 'standard', 'challenge')),
  question JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_questions_institution_idx ON bank_questions (institution_id);
CREATE INDEX IF NOT EXISTS bank_questions_creator_idx ON bank_questions (creator_id);
CREATE INDEX IF NOT EXISTS bank_questions_subject_idx ON bank_questions (institution_id, subject);

ALTER TABLE exam_submissions
  ADD COLUMN IF NOT EXISTS extra_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invigilator_message TEXT,
  ADD COLUMN IF NOT EXISTS invigilator_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presentation JSONB;

ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_questions_select ON bank_questions;
CREATE POLICY bank_questions_select ON bank_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS bank_questions_insert ON bank_questions;
CREATE POLICY bank_questions_insert ON bank_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS bank_questions_update ON bank_questions;
CREATE POLICY bank_questions_update ON bank_questions FOR UPDATE USING (true);

DROP POLICY IF EXISTS bank_questions_delete ON bank_questions;
CREATE POLICY bank_questions_delete ON bank_questions FOR DELETE USING (true);
