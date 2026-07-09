-- RLS for marketplace_imports: personal + institution member access

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS marketplace_imports_select_own ON marketplace_imports;
CREATE POLICY marketplace_imports_select_own ON marketplace_imports
  FOR SELECT
  USING (
    imported_by = auth.uid()
    OR (
      institution_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM institution_members m
        WHERE m.institution_id = marketplace_imports.institution_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS marketplace_imports_insert_own ON marketplace_imports;
CREATE POLICY marketplace_imports_insert_own ON marketplace_imports
  FOR INSERT
  WITH CHECK (
    imported_by = auth.uid()
    AND (
      institution_id IS NULL
      OR EXISTS (
        SELECT 1 FROM institution_members m
        WHERE m.institution_id = marketplace_imports.institution_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
      )
    )
  );
