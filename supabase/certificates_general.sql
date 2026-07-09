-- =====================================================
-- Certificates beyond Train: per-resource issuance toggle
-- for exams and courses. Run after schema_v2.sql.
-- =====================================================

-- Per-resource toggle: does completing this exam / course issue a certificate?
ALTER TABLE exams   ADD COLUMN IF NOT EXISTS issues_certificate BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS issues_certificate BOOLEAN DEFAULT false;

-- Optional pass mark for exams that gate a certificate (percentage 0-100).
ALTER TABLE exams   ADD COLUMN IF NOT EXISTS certificate_pass_mark INT DEFAULT 50;

-- Seed the new AI Engagement Builder add-on if it is not present yet.
INSERT INTO add_ons (id, name, description, price_ghs, eligible_plans) VALUES
  ('ai_engagement_builder','AI Engagement Builder','Generate a full live quiz game from a topic prompt.', 100, ARRAY['creator_quarterly','creator_marketplace','institution'])
ON CONFLICT DO NOTHING;
