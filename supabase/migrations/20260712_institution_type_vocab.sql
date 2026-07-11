-- =====================================================================
-- Institution type vocabulary. Each type carries its own language so a
-- Corporate/Company is never asked about an "academic year" and a
-- university isn't asked about "departments".
--
--   level_language      singular word for a level  (Grade / Year / Department / Cohort)
--   calendar_language   word for the year concept   (Academic year / Fiscal year / Program year)
--   has_academic_calendar   whether a start-of-year calendar applies at all
--
-- period_language already exists (Term / Semester / Quarter / Module).
-- Safe to re-run.
-- =====================================================================

ALTER TABLE institution_types ADD COLUMN IF NOT EXISTS level_language TEXT DEFAULT 'Level';
ALTER TABLE institution_types ADD COLUMN IF NOT EXISTS calendar_language TEXT DEFAULT 'Academic year';
ALTER TABLE institution_types ADD COLUMN IF NOT EXISTS has_academic_calendar BOOLEAN DEFAULT true;

-- Seed the eight default types with correct vocabulary.
UPDATE institution_types SET level_language='Class',      calendar_language='Academic year', has_academic_calendar=true  WHERE id='primary';
UPDATE institution_types SET level_language='Form',       calendar_language='Academic year', has_academic_calendar=true  WHERE id='jhs';
UPDATE institution_types SET level_language='Form',       calendar_language='Academic year', has_academic_calendar=true  WHERE id='shs';
UPDATE institution_types SET level_language='Level',      calendar_language='Academic year', has_academic_calendar=true  WHERE id='university';
UPDATE institution_types SET level_language='Year',       calendar_language='Academic year', has_academic_calendar=true  WHERE id='college';
UPDATE institution_types SET level_language='Cohort',     calendar_language='Program year',  has_academic_calendar=true  WHERE id='training';
UPDATE institution_types SET level_language='Department', calendar_language='Fiscal year',   has_academic_calendar=false WHERE id='corporate';
UPDATE institution_types SET level_language='Cohort',     calendar_language='Program year',  has_academic_calendar=false WHERE id='professional';
