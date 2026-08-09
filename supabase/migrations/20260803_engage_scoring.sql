-- =====================================================================
-- Engage scoring: make it an actual game.
--
-- The schema already anticipated this. session_responses.response_time_ms
-- and session_participants.streak have existed since the start and were
-- never written to, because there was no trustworthy moment to measure
-- from. This adds that anchor.
--
-- question_started_at is set by the host when a question opens. Every
-- client times against the server's clock rather than its own, so a slow
-- phone or a late render does not cost a student points. That matters
-- here: in a classroom on shared devices and patchy data, client-side
-- timing measures the handset, not the learner.
--
-- The scoring model itself lives in engage_sessions.settings (JSONB), so
-- a teacher can tune speed weighting per session without a migration.
--
-- Safe to re-run.
-- =====================================================================

ALTER TABLE engage_sessions
  ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;

-- Per-question answer tallies drive the live misconception panel, so the
-- host can see which wrong option the class actually fell for.
CREATE INDEX IF NOT EXISTS idx_session_responses_question
  ON session_responses(session_id, question_index);
