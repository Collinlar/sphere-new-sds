-- Credential snapshot on issued certificates so /verify can show issuer +
-- achievement without relying on mutable submissions or ambiguous joins.
ALTER TABLE public.issued_certificates
  ADD COLUMN IF NOT EXISTS issuer_display_name TEXT,
  ADD COLUMN IF NOT EXISTS achievement_summary TEXT,
  ADD COLUMN IF NOT EXISTS score_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS pass_mark INTEGER;
