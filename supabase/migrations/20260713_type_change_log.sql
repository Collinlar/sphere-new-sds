-- =====================================================================
-- Audit trail for institution type changes. Each entry records
-- { from, to, at }. Changing a primary type is a vocabulary switch, not
-- a destructive event, because the institution's effective levels are
-- additive (custom_levels + extra_level_type_ids). Safe to re-run.
-- =====================================================================

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS type_change_log JSONB DEFAULT '[]';
