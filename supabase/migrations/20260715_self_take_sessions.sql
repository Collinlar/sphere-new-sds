-- Self-serve exam sessions for membership marketplace take flow

ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_exam_sessions_self_serve
  ON exam_sessions ((settings->>'owner_id'))
  WHERE (settings->>'self_serve') = 'true';
