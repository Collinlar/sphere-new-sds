-- =====================================================
-- SphereSDS-assisted content creation.
-- A creator asks Sphere to build a resource with them (or Sphere
-- proactively offers). Commission is negotiated per deal and can be
-- applied to the resulting listing. Run after schema_v2.sql.
-- =====================================================

CREATE TABLE IF NOT EXISTS assist_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_by TEXT NOT NULL DEFAULT 'creator',   -- 'creator' | 'sphere'
  brief TEXT,                                      -- what they want built
  status TEXT NOT NULL DEFAULT 'requested',        -- 'requested' | 'quoted' | 'in_progress' | 'delivered' | 'declined'
  agreed_commission_rate NUMERIC(5,2),             -- negotiated per deal
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assist_requests_creator ON assist_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_assist_requests_status ON assist_requests(status);

ALTER TABLE assist_requests DISABLE ROW LEVEL SECURITY;
