-- =====================================================
-- Quota periods: creation quotas renew per period.
--   membership        -> monthly (calendar-agnostic, 1 month from period start)
--   creator_quarterly -> quarterly (3 months from period start)
--   marketplace / institution -> unlimited, no reset needed
-- The reset is lazy: applied the next time a quota is read after
-- the period has rolled over. Run after schema_v2.sql.
-- =====================================================

ALTER TABLE creation_usage ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ DEFAULT now();

-- Backfill any existing rows that predate the column.
UPDATE creation_usage SET period_start = now() WHERE period_start IS NULL;
