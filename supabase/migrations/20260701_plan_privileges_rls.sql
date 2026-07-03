-- Plan privilege enforcement: marketplace publish RLS
-- Membership users can browse but not insert marketplace resources.

CREATE OR REPLACE FUNCTION public.user_can_sell_marketplace(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT sp.can_sell_marketplace
      FROM users u
      LEFT JOIN institutions i ON i.id = u.institution_id AND u.role = 'admin'
      JOIN subscription_plans sp ON sp.id = CASE
        WHEN u.role = 'admin' AND i.subscription_plan IS NOT NULL THEN
          CASE WHEN i.subscription_plan = 'trial' THEN 'membership' ELSE i.subscription_plan END
        ELSE COALESCE(u.subscription_tier, 'membership')
      END
      WHERE u.id = uid
      LIMIT 1
    ),
    false
  );
$$;

ALTER TABLE marketplace_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_resources_select ON marketplace_resources;
CREATE POLICY marketplace_resources_select ON marketplace_resources
  FOR SELECT
  TO authenticated, anon
  USING (status = 'published' OR creator_id = auth.uid());

DROP POLICY IF EXISTS marketplace_resources_insert ON marketplace_resources;
CREATE POLICY marketplace_resources_insert ON marketplace_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.user_can_sell_marketplace(auth.uid())
  );

DROP POLICY IF EXISTS marketplace_resources_update_own ON marketplace_resources;
CREATE POLICY marketplace_resources_update_own ON marketplace_resources
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (
    creator_id = auth.uid()
    AND public.user_can_sell_marketplace(auth.uid())
  );

DROP POLICY IF EXISTS marketplace_resources_delete_own ON marketplace_resources;
CREATE POLICY marketplace_resources_delete_own ON marketplace_resources
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Sphere staff can review any submission
DROP POLICY IF EXISTS marketplace_resources_staff_all ON marketplace_resources;
CREATE POLICY marketplace_resources_staff_all ON marketplace_resources
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
