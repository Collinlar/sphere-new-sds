-- Marketplace unification: link legacy resources to schema v2 listings

ALTER TABLE marketplace_resources
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;

ALTER TABLE marketplace_imports
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_resources_listing ON marketplace_resources(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_imports_listing ON marketplace_imports(listing_id);

-- RLS on marketplace_listings (mirrors marketplace_resources plan gate)
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_listings_select ON marketplace_listings;
CREATE POLICY marketplace_listings_select ON marketplace_listings
  FOR SELECT
  TO authenticated, anon
  USING (status = 'approved' OR creator_id = auth.uid());

DROP POLICY IF EXISTS marketplace_listings_insert ON marketplace_listings;
CREATE POLICY marketplace_listings_insert ON marketplace_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.user_can_sell_marketplace(auth.uid())
  );

DROP POLICY IF EXISTS marketplace_listings_update_own ON marketplace_listings;
CREATE POLICY marketplace_listings_update_own ON marketplace_listings
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (
    creator_id = auth.uid()
    AND public.user_can_sell_marketplace(auth.uid())
  );

DROP POLICY IF EXISTS marketplace_listings_delete_own ON marketplace_listings;
CREATE POLICY marketplace_listings_delete_own ON marketplace_listings
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS marketplace_listings_staff_all ON marketplace_listings;
CREATE POLICY marketplace_listings_staff_all ON marketplace_listings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_sphere_staff = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_sphere_staff = true
    )
  );
