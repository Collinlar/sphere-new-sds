-- =====================================================
-- Institution flexibility:
--   - academic_year_start_month: per-institution override of the
--     type default (a Takoradi college can start in January).
--   - custom_levels: extra levels the institution defines on top of
--     the seeded set, [{id,label}]. Seeded levels are never removed.
--   - extra_level_type_ids: additional level groups borrowed from
--     other institution types (a university that also runs corporate
--     training enables the 'corporate' group alongside its own).
-- Run after schema_v2.sql.
-- =====================================================

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS academic_year_start_month INT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS custom_levels JSONB DEFAULT '[]';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS extra_level_type_ids TEXT[] DEFAULT '{}';
