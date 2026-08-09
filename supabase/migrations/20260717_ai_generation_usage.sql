-- =====================================================================
-- AI generation metering.
--
-- Inference cost per generation is small, but add-ons are flat monthly
-- subscriptions with no ceiling, so a runaway script or a stuck retry
-- loop could generate without limit and nobody would see it. This adds a
-- per-account monthly counter with a generous default cap, and gives
-- admin visibility into who is generating what.
--
-- The period resets lazily on read, the same pattern as creation_usage,
-- so no scheduled job is needed.
--
-- Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_generation_usage (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  generations_used INT NOT NULL DEFAULT 0,
  -- Lifetime tally, never reset, for admin trend visibility.
  generations_all_time INT NOT NULL DEFAULT 0,
  -- Per-account override. NULL means use the platform default.
  monthly_limit INT,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_last_generated
  ON ai_generation_usage(last_generated_at DESC);

ALTER TABLE ai_generation_usage ENABLE ROW LEVEL SECURITY;

-- A creator can read their own usage. Writes happen server-side with the
-- service role, which bypasses RLS.
DROP POLICY IF EXISTS ai_generation_usage_own ON ai_generation_usage;
CREATE POLICY ai_generation_usage_own ON ai_generation_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- Platform default cap, tunable from Platform config without a deploy.
INSERT INTO platform_settings (key, value) VALUES
  ('ai_monthly_generation_limit', '300')
ON CONFLICT (key) DO NOTHING;
