-- Institution plan inquiry capture

CREATE TABLE IF NOT EXISTS institution_plan_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  institution_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  student_count INT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_plan_inquiries_status ON institution_plan_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_institution_plan_inquiries_created ON institution_plan_inquiries(created_at DESC);

ALTER TABLE institution_plan_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS institution_plan_inquiries_insert_own ON institution_plan_inquiries;
CREATE POLICY institution_plan_inquiries_insert_own ON institution_plan_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS institution_plan_inquiries_select_own ON institution_plan_inquiries;
CREATE POLICY institution_plan_inquiries_select_own ON institution_plan_inquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS institution_plan_inquiries_staff_all ON institution_plan_inquiries;
CREATE POLICY institution_plan_inquiries_staff_all ON institution_plan_inquiries
  FOR ALL TO authenticated
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
