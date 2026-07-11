-- =====================================================
-- Creator payout requests (My Sales dashboard).
-- Run after schema_v2.sql.
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ghs NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',  -- 'requested' | 'paid' | 'rejected'
  method TEXT,                               -- e.g. 'MTN MoMo'
  destination TEXT,                          -- masked number the creator wants paid to
  requested_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON marketplace_payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON marketplace_payout_requests(status);

ALTER TABLE marketplace_payout_requests DISABLE ROW LEVEL SECURITY;

-- Optional: store the creator's preferred payout destination on their profile.
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS payout_destination TEXT;
