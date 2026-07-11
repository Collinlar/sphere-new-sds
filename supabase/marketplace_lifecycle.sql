-- =====================================================
-- Marketplace-route creator lifecycle.
--   - suspended_at: when staff suspended the creator (grace clock).
--     Listings stay live for the grace window, then auto-delist.
-- Run after schema_v2.sql.
-- =====================================================

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
