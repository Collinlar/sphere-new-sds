-- Marketplace import scope: personal vs institution uniqueness

-- Drop legacy unique constraint if it exists (resource_id + institution_id)
ALTER TABLE marketplace_imports
  DROP CONSTRAINT IF EXISTS marketplace_imports_resource_id_institution_id_key;

-- Institution-scoped imports: one copy per listing per institution
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_imports_listing_institution
  ON marketplace_imports (listing_id, institution_id)
  WHERE listing_id IS NOT NULL AND institution_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_imports_resource_institution
  ON marketplace_imports (resource_id, institution_id)
  WHERE resource_id IS NOT NULL AND institution_id IS NOT NULL;

-- Personal-scoped imports: one copy per listing per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_imports_listing_personal
  ON marketplace_imports (listing_id, imported_by)
  WHERE listing_id IS NOT NULL AND institution_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_imports_resource_personal
  ON marketplace_imports (resource_id, imported_by)
  WHERE resource_id IS NOT NULL AND institution_id IS NULL;
