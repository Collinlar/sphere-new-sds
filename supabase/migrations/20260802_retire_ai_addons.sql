-- =====================================================================
-- Retire the AI add-on subscriptions. Credits become the only AI purchase.
--
-- WHY
--   Add-ons gated ENTRY (a monthly fee just to reach the feature) while
--   credits gate USE. Charging twice for the same thing suppressed exactly
--   the trial behaviour credits exist to create. From here:
--
--     * Anyone on any plan can open an AI builder.
--     * Every account starts with a signup grant, enough for one real exam.
--     * Plans include monthly credits; top-ups buy more.
--     * Running out of credits is the only thing that stops a generation.
--
--   This is the freemium gate the wrapper tools already use: the first
--   result is free, and the gate comes after the value is felt.
--
-- NOBODY IS STRANDED
--   user_add_ons rows are untouched. Anyone still subscribed keeps their
--   row, sees it flagged as included, and can cancel when they choose.
--   The server treats a retired add-on as "granted to everyone", so an
--   active legacy subscription is never the thing standing in the way.
--
-- ORDERING: must run after 20260718_ai_engage_training_addons.sql, which
-- re-upserts builder rows and would otherwise resurrect them.
--
-- Safe to re-run.
-- =====================================================================

UPDATE add_ons
SET is_active = false
WHERE id IN (
  'ai_course_builder',
  'ai_assessment_builder',
  'ai_engagement_builder',
  'ai_training_builder',
  'ai_hints',
  'ai_explanations'
);

-- Eligibility now spans every plan: the free tier must be able to try AI,
-- because the signup grant is the top of the funnel.
UPDATE add_ons
SET eligible_plans = ARRAY['membership','creator_quarterly','creator_marketplace','institution']
WHERE id LIKE 'ai_%';
