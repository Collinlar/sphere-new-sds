-- Self-serve institutions were incorrectly created on the full Institution plan.
-- Restore membership defaults unless onboarding deposit was paid.

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS onboarding_deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_deposit_reference TEXT;

UPDATE institutions
SET
  subscription_plan = 'membership',
  modules = '["engage"]'::jsonb
WHERE subscription_plan = 'institution'
  AND onboarding_deposit_paid_at IS NULL
  AND owner_user_id IS NOT NULL;
