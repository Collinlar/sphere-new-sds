-- =====================================================================
-- Fold AI Hints and AI Explanations into the builders.
--
-- Hints and explanations cost almost nothing to produce in the same
-- generation pass, and withholding them made the flagship builders feel
-- unfinished. They now ship with every builder, and the two standalone
-- add-ons are retired.
--
-- Nobody is stranded: existing user_add_ons rows are left untouched, so
-- anyone currently paying for ai_hints or ai_explanations keeps working
-- access. Those two are only removed from the catalogue (is_active =
-- false) so no new subscriptions start. The server also accepts either
-- the legacy add-on or the relevant builder for hint/explanation tasks.
--
-- ORDERING: this must run AFTER 20260718_ai_engage_training_addons.sql,
-- which upserts ai_engagement_builder back to GHS 100 and would otherwise
-- silently revert the repricing below. Hence the late date.
--
-- Safe to re-run.
-- =====================================================================

-- Retire the two standalone add-ons from the catalogue.
UPDATE add_ons SET is_active = false
WHERE id IN ('ai_hints', 'ai_explanations');

-- Builders now deliver hints, explanations, mark schemes, and per-option
-- misconception notes in one pass. Price reflects the fold-in and is still
-- below the old builder + hints + explanations bundle.
UPDATE add_ons
SET price_ghs = 150,
    description = 'Generate exams and question sets from a topic or syllabus, with answer keys, mark schemes, hints, and student explanations included.'
WHERE id = 'ai_assessment_builder';

UPDATE add_ons
SET price_ghs = 150,
    description = 'Generate a full live quiz game from a topic prompt, with answer keys and reveal explanations included.'
WHERE id = 'ai_engagement_builder';

UPDATE add_ons
SET description = 'Generate a full course outline and module content from a topic prompt, with learning objectives, quiz explanations, and marking criteria included.'
WHERE id = 'ai_course_builder';

UPDATE add_ons
SET description = 'Generate structured training paths and step content from a brief, with objectives, quiz explanations, and supervisor criteria included.'
WHERE id = 'ai_training_builder';
