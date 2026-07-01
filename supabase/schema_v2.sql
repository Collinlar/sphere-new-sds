-- SphereSDS Schema v2 — Subscription, Marketplace, Content Types, Certificates, Guest Sessions
-- Run this in the Supabase SQL editor AFTER schema.sql

-- =====================
-- INSTITUTION TYPES
-- Pre-populated with Ghanaian education + corporate defaults.
-- Admin can add more via the master admin panel (future phase).
-- =====================

CREATE TABLE IF NOT EXISTS institution_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  period_language TEXT NOT NULL,       -- 'Term', 'Semester', 'Intake', 'Quarter'
  period_count INT NOT NULL,            -- how many periods per academic year
  levels JSONB NOT NULL,                -- [{id:'jhs1', label:'JHS 1'}, ...]
  academic_year_start_month INT DEFAULT 9,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO institution_types (id, name, period_language, period_count, levels, academic_year_start_month) VALUES
  ('jhs', 'Junior High School (JHS)', 'Term', 3,
    '[{"id":"jhs1","label":"JHS 1"},{"id":"jhs2","label":"JHS 2"},{"id":"jhs3","label":"JHS 3"}]'::jsonb, 9),
  ('shs', 'Senior High School (SHS)', 'Term', 3,
    '[{"id":"shs1","label":"SHS 1"},{"id":"shs2","label":"SHS 2"},{"id":"shs3","label":"SHS 3"}]'::jsonb, 9),
  ('primary', 'Primary School', 'Term', 3,
    '[{"id":"p1","label":"Primary 1"},{"id":"p2","label":"Primary 2"},{"id":"p3","label":"Primary 3"},{"id":"p4","label":"Primary 4"},{"id":"p5","label":"Primary 5"},{"id":"p6","label":"Primary 6"}]'::jsonb, 9),
  ('university', 'University', 'Semester', 2,
    '[{"id":"yr1","label":"Year 1"},{"id":"yr2","label":"Year 2"},{"id":"yr3","label":"Year 3"},{"id":"yr4","label":"Year 4"}]'::jsonb, 9),
  ('college', 'Polytechnic / College', 'Semester', 2,
    '[{"id":"l100","label":"Level 100"},{"id":"l200","label":"Level 200"},{"id":"l300","label":"Level 300"},{"id":"l400","label":"Level 400"}]'::jsonb, 9),
  ('training', 'Training Institution', 'Intake', 4,
    '[{"id":"c1","label":"Cohort 1"},{"id":"c2","label":"Cohort 2"},{"id":"c3","label":"Cohort 3"},{"id":"c4","label":"Cohort 4"}]'::jsonb, 1),
  ('corporate', 'Corporate / Company', 'Quarter', 4,
    '[{"id":"q1","label":"Q1"},{"id":"q2","label":"Q2"},{"id":"q3","label":"Q3"},{"id":"q4","label":"Q4"}]'::jsonb, 1),
  ('professional', 'Professional Body', 'Semester', 2,
    '[{"id":"l1","label":"Foundation"},{"id":"l2","label":"Intermediate"},{"id":"l3","label":"Advanced"},{"id":"l4","label":"Professional"}]'::jsonb, 1)
ON CONFLICT DO NOTHING;

-- Link institutions to their type
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS institution_type_id TEXT REFERENCES institution_types(id) ON DELETE SET NULL;

-- =====================
-- SUBSCRIPTION PLANS
-- =====================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_ghs NUMERIC(10,2),
  billing_period TEXT,                  -- 'quarterly', 'monthly', null = free or commission-based
  assess_quota INT,                     -- null = unlimited
  engage_quota INT,
  learn_quota INT,
  train_quota INT,
  total_creation_pool INT,              -- for plans with a redistributable pool (creator_quarterly)
  session_student_cap INT,              -- max students per live session
  enrolled_student_cap INT,             -- max enrolled students (institution only)
  can_sell_marketplace BOOLEAN DEFAULT false,
  marketplace_commission_rate NUMERIC(5,2) DEFAULT 0,
  can_issue_certificates BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO subscription_plans (
  id, name, price_ghs, billing_period,
  assess_quota, engage_quota, learn_quota, train_quota, total_creation_pool,
  session_student_cap, enrolled_student_cap,
  can_sell_marketplace, marketplace_commission_rate, can_issue_certificates
) VALUES
  ('membership', 'Membership', 0, null,
    5, 5, 0, 0, null,
    5, null,
    false, 0, false),
  ('creator_quarterly', 'Creator — Quarterly', 300, 'quarterly',
    null, null, null, null, 40,
    50, null,
    true, 15, true),
  ('creator_marketplace', 'Creator — Marketplace', 0, null,
    null, null, null, null, null,
    null, null,
    true, 30, true),
  ('institution', 'Institution', null, 'monthly',
    null, null, null, null, null,
    null, 100,
    true, 15, true)
ON CONFLICT DO NOTHING;

-- =====================
-- USER SUBSCRIPTION & CREATION TRACKING
-- =====================

-- Add subscription fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'membership' REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_level TEXT;            -- e.g. 'jhs1', 'shs2', 'yr1'
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_type TEXT;            -- e.g. 'jhs', 'university', 'corporate'
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_slug TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;            -- for corporate/employee context

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active',         -- 'active', 'cancelled', 'expired', 'suspended'
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);

-- Tracks how many creations a user has used per module, and their quota allocation.
-- For creator_quarterly, the 40-pool is split by the user (assess+engage+learn+train = total).
-- For other plans, quotas are fixed per plan.
CREATE TABLE IF NOT EXISTS creation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  assess_quota INT DEFAULT 5,
  engage_quota INT DEFAULT 5,
  learn_quota INT DEFAULT 0,
  train_quota INT DEFAULT 0,
  assess_used INT DEFAULT 0,
  engage_used INT DEFAULT 0,
  learn_used INT DEFAULT 0,
  train_used INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creation_usage_user ON creation_usage(user_id);

-- =====================
-- CREATOR PROFILES & STOREFRONTS
-- =====================

CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  tagline TEXT,
  avatar_url TEXT,
  banner_color TEXT DEFAULT '#1A8966',
  is_approved BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  total_sales INT DEFAULT 0,
  total_revenue_ghs NUMERIC(12,2) DEFAULT 0,
  marketplace_route_active BOOLEAN DEFAULT false,  -- true = on marketplace route
  last_creation_check TIMESTAMPTZ,                  -- last time 30-day eligibility was checked
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_slug ON creator_profiles(slug);

-- =====================
-- MARKETPLACE
-- =====================

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL,   -- 'course','exam','quiz','guide','notes','document','training_path'
  resource_id UUID NOT NULL,
  price_ghs NUMERIC(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  is_entry_resource BOOLEAN DEFAULT false,  -- creator's one free showcase listing
  target_level_types TEXT[],     -- ['jhs','shs'] — which institution types this suits
  target_levels TEXT[],          -- specific level ids like ['jhs1','jhs2']
  subject TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'draft',   -- 'draft','pending_review','approved','rejected','suspended'
  admin_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  total_purchases INT DEFAULT 0,
  total_revenue_ghs NUMERIC(12,2) DEFAULT 0,
  slug TEXT UNIQUE,
  thumbnail_color TEXT DEFAULT '#1A8966',
  commission_rate NUMERIC(5,2),   -- locked in at approval time based on creator's plan
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_creator ON marketplace_listings(creator_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_slug ON marketplace_listings(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_type ON marketplace_listings(resource_type);

CREATE TABLE IF NOT EXISTS marketplace_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  price_ghs NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_ghs NUMERIC(10,2) NOT NULL,
  creator_earnings_ghs NUMERIC(10,2) NOT NULL,
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending', -- 'pending','completed','refunded'
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_buyer ON marketplace_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_listing ON marketplace_purchases(listing_id);

-- Track co-created content (Sphere team + creator partnerships)
CREATE TABLE IF NOT EXISTS cocreation_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  initiated_by TEXT NOT NULL,            -- 'creator' or 'sphere'
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  sphere_cut NUMERIC(5,2) DEFAULT 35,
  creator_cut NUMERIC(5,2) DEFAULT 65,
  status TEXT DEFAULT 'proposed',        -- 'proposed','active','completed','cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add marketplace FK to resource tables
ALTER TABLE exams    ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE quizzes  ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE courses  ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;

-- =====================
-- AI ADD-ONS
-- =====================

CREATE TABLE IF NOT EXISTS add_ons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_ghs NUMERIC(10,2),
  billing_period TEXT DEFAULT 'monthly',
  eligible_plans TEXT[],                 -- which subscription plans can buy this
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO add_ons (id, name, description, price_ghs, eligible_plans) VALUES
  ('ai_course_builder',    'AI Course Builder',    'Generate a full course outline, modules, and content from a topic prompt.', 150, ARRAY['creator_quarterly','creator_marketplace','institution']),
  ('ai_assessment_builder','AI Assessment Builder','Generate exams and question sets from a topic, syllabus, or document.',     100, ARRAY['creator_quarterly','creator_marketplace','institution']),
  ('ai_hints',             'AI Hints',             'Auto-generate contextual hints for exam and quiz questions.',                 50,  ARRAY['creator_quarterly','creator_marketplace','institution']),
  ('ai_explanations',      'AI Explanations',      'Auto-generate answer explanations shown to students after submission.',      50,  ARRAY['creator_quarterly','creator_marketplace','institution']),
  ('ai_training_builder',  'AI Training Builder',  'Generate structured training paths and step content from a brief.',         null, ARRAY['creator_quarterly','creator_marketplace','institution'])
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  add_on_id TEXT REFERENCES add_ons(id),
  status TEXT DEFAULT 'active',          -- 'active','cancelled','expired'
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_reference TEXT,
  UNIQUE(user_id, add_on_id)
);

CREATE INDEX IF NOT EXISTS idx_user_add_ons_user ON user_add_ons(user_id);

-- =====================
-- NEW CONTENT TYPES: GUIDES, NOTES, DOCUMENTS
-- =====================

-- Guide: structured step-by-step instructional mini-set
-- Distinct look from Notes; designed to walk someone through a process
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_color TEXT DEFAULT '#1052A3',
  steps JSONB DEFAULT '[]',   -- [{title, body, image_url, tip}]
  estimated_minutes INT,
  subject TEXT,
  grade_level TEXT,
  is_published BOOLEAN DEFAULT false,
  marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notes: rich personal/shareable document — text, images, video links, downloadable
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cover_color TEXT DEFAULT '#2E2886',
  blocks JSONB DEFAULT '[]',   -- [{type:'text'|'image'|'video_link'|'link'|'callout', content:{}}]
  is_published BOOLEAN DEFAULT false,
  is_downloadable BOOLEAN DEFAULT true,
  subject TEXT,
  grade_level TEXT,
  marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents: either editor-built (like a syllabus or policy) or uploaded file
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cover_color TEXT DEFAULT '#D97010',
  content_type TEXT NOT NULL DEFAULT 'editor', -- 'editor' | 'upload'
  content JSONB,               -- for editor-built docs: structured blocks
  file_url TEXT,               -- for uploaded docs
  file_name TEXT,
  file_size_bytes INT,
  mime_type TEXT,              -- 'application/pdf', 'image/png', etc.
  is_published BOOLEAN DEFAULT false,
  subject TEXT,
  grade_level TEXT,
  marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guides_creator ON guides(creator_id);
CREATE INDEX IF NOT EXISTS idx_notes_creator ON notes(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);

-- =====================
-- CERTIFICATES (expanded)
-- The existing `certificates` table tracks Train completions.
-- This new table covers all resource types (course, exam, training path).
-- =====================

CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,              -- 'creator', 'institution', 'sphere'
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'sphere_default', -- 'sphere_default' | 'custom_upload'
  file_url TEXT,                         -- uploaded PDF or image
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  issuer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,           -- 'course', 'exam', 'training_path'
  resource_id UUID NOT NULL,
  resource_title TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  certificate_url TEXT,
  verification_code TEXT UNIQUE DEFAULT 'SPH-' || upper(substring(gen_random_uuid()::text, 1, 8))
);

CREATE INDEX IF NOT EXISTS idx_issued_certs_recipient ON issued_certificates(recipient_id);

-- Certificate feature flags: who can issue certificates
CREATE TABLE IF NOT EXISTS certificate_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  owner_type TEXT NOT NULL,              -- 'creator', 'institution'
  is_enabled BOOLEAN DEFAULT true,       -- Sphere admin can flip this
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- GUEST SESSION RECOVERY
-- Covers exam submissions and engage sessions taken without an account.
-- Recovery: same-browser auto-claim via localStorage token, or
-- 6-character claim code shown on results page for cross-device recovery.
-- =====================

CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL,            -- 'exam' | 'engage'
  resource_session_id UUID NOT NULL,     -- exam_session_id or engage_session_id
  submission_id UUID,                    -- exam_submission_id or session_participant_id
  display_name TEXT,
  claim_token TEXT UNIQUE NOT NULL,      -- 6-char alphanumeric shown on results page
  browser_token TEXT,                    -- random UUID stored in localStorage for same-browser auto-claim
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_claim_token ON guest_sessions(claim_token);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_browser_token ON guest_sessions(browser_token);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_claimed_by ON guest_sessions(claimed_by);

-- =====================
-- RPC HELPERS FOR CREATION USAGE
-- =====================

CREATE OR REPLACE FUNCTION increment_creation_used(p_user_id UUID, p_field TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE creation_usage
  SET updated_at = now(),
      assess_used  = CASE WHEN p_field = 'assess_used'  THEN assess_used  + 1 ELSE assess_used  END,
      engage_used  = CASE WHEN p_field = 'engage_used'  THEN engage_used  + 1 ELSE engage_used  END,
      learn_used   = CASE WHEN p_field = 'learn_used'   THEN learn_used   + 1 ELSE learn_used   END,
      train_used   = CASE WHEN p_field = 'train_used'   THEN train_used   + 1 ELSE train_used   END
  WHERE user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION decrement_creation_used(p_user_id UUID, p_field TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE creation_usage
  SET updated_at = now(),
      assess_used  = CASE WHEN p_field = 'assess_used'  THEN GREATEST(assess_used  - 1, 0) ELSE assess_used  END,
      engage_used  = CASE WHEN p_field = 'engage_used'  THEN GREATEST(engage_used  - 1, 0) ELSE engage_used  END,
      learn_used   = CASE WHEN p_field = 'learn_used'   THEN GREATEST(learn_used   - 1, 0) ELSE learn_used   END,
      train_used   = CASE WHEN p_field = 'train_used'   THEN GREATEST(train_used   - 1, 0) ELSE train_used   END
  WHERE user_id = p_user_id;
END $$;

-- =====================
-- DISABLE RLS ON ALL NEW TABLES
-- (Consistent with existing schema pattern)
-- =====================

ALTER TABLE institution_types       DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans      DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE creation_usage          DISABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings    DISABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_purchases   DISABLE ROW LEVEL SECURITY;
ALTER TABLE cocreation_agreements   DISABLE ROW LEVEL SECURITY;
ALTER TABLE add_ons                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_add_ons            DISABLE ROW LEVEL SECURITY;
ALTER TABLE guides                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents               DISABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates   DISABLE ROW LEVEL SECURITY;
ALTER TABLE issued_certificates     DISABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions          DISABLE ROW LEVEL SECURITY;
