-- =====================================================
-- Marketplace curation: admin-controlled featuring.
-- Run after schema_v2.sql.
-- =====================================================

ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_featured
  ON marketplace_listings(is_featured) WHERE is_featured = true;
