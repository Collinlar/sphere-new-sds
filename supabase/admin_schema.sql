-- SphereSDS Admin Schema
-- Run in Supabase SQL editor AFTER schema.sql and schema_v2.sql

-- Staff flag on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sphere_staff BOOLEAN DEFAULT false;

-- Seed Collins as staff (replace with real user ID after first login)
-- UPDATE users SET is_sphere_staff = true WHERE email = 'your@email.com';

-- Marketplace listings: ensure total_purchases column exists with default
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS total_purchases INT DEFAULT 0;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS total_revenue_ghs NUMERIC(12,2) DEFAULT 0;

-- Creator profiles: approval status tracking
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- Marketplace listings: rejection note
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

-- Disable RLS on users table (consistent with existing pattern)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
