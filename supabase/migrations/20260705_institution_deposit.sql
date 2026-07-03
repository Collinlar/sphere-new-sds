-- Institution onboarding deposit tracking

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS onboarding_deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_deposit_reference TEXT;

ALTER TABLE institution_plan_inquiries
  ADD COLUMN IF NOT EXISTS deposit_reference TEXT,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
