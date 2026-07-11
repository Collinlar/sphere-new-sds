-- =====================================================================
-- Institution verification. Anyone can create an institution and use it
-- internally immediately, but brand-facing powers (custom-branded
-- certificates, public directory presence) require admin verification.
--   'unverified' -> 'pending' -> 'verified' | 'rejected'
-- Safe to re-run.
-- =====================================================================

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS verification_note TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_institutions_verification ON institutions(verification_status);
