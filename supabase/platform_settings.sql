-- =====================================================
-- Platform settings: a small key/value store for admin-tunable
-- values that aren't tied to a specific row (guest TTL, etc.).
-- Run anytime; safe to re-run.
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;

INSERT INTO platform_settings (key, value) VALUES
  ('guest_session_ttl_days', '30')
ON CONFLICT (key) DO NOTHING;
