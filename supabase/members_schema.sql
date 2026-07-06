-- =====================================================
-- SphereSDS Members Schema
-- One account, one tier, many institution memberships.
-- Run this in the Supabase SQL editor AFTER schema.sql,
-- schema_v2.sql and admin_schema.sql.
-- =====================================================

-- =====================
-- INSTITUTION MEMBERS
-- =====================
-- Replaces users.role + users.institution_id as the source
-- of truth for who belongs to which institution and as what.

CREATE TABLE IF NOT EXISTS institution_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,   -- null until an invite is claimed
  member_role TEXT NOT NULL DEFAULT 'student',            -- 'owner' | 'admin' | 'teacher' | 'student'
  status TEXT NOT NULL DEFAULT 'active',                  -- 'invited' | 'active' | 'removed'
  invited_email TEXT,                                     -- for email invites to people not yet on Sphere
  claim_code TEXT,                                        -- 6-char code for no-email invites
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT,                                      -- name as entered by the institution (pre-claim)
  level_id TEXT,                                          -- student's level within the institution (e.g. 'jhs2')
  joined_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One active membership per user per institution
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_active
  ON institution_members (institution_id, user_id)
  WHERE user_id IS NOT NULL AND status != 'removed';

CREATE INDEX IF NOT EXISTS idx_members_user ON institution_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_institution ON institution_members (institution_id);
CREATE INDEX IF NOT EXISTS idx_members_claim_code ON institution_members (claim_code) WHERE claim_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_invited_email ON institution_members (invited_email) WHERE invited_email IS NOT NULL;

ALTER TABLE institution_members DISABLE ROW LEVEL SECURITY;

-- =====================
-- INSTITUTION OWNERSHIP
-- =====================

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- =====================
-- CONTENT CONTEXT
-- =====================
-- Content created in institution context belongs to the institution
-- (stays when the creator leaves). Personal content has institution_id null.
-- Most content tables already have institution_id; ensure they all do.

ALTER TABLE exams          ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE quizzes        ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE courses        ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE guides         ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE notes          ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE documents      ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

-- =====================
-- BACKFILL
-- =====================
-- Every existing user with an institution_id becomes a member of that
-- institution, carrying over their legacy role.
-- Legacy role mapping: hr -> admin, employee -> student.

INSERT INTO institution_members (institution_id, user_id, member_role, status, joined_at)
SELECT
  u.institution_id,
  u.id,
  CASE
    WHEN u.role = 'hr' THEN 'admin'
    WHEN u.role = 'employee' THEN 'student'
    WHEN u.role IN ('owner', 'admin', 'teacher', 'student') THEN u.role
    ELSE 'student'
  END,
  'active',
  u.created_at
FROM users u
WHERE u.institution_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM institution_members m
    WHERE m.user_id = u.id AND m.institution_id = u.institution_id AND m.status != 'removed'
  );

-- The first admin of each institution becomes its owner
UPDATE institutions i
SET owner_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (institution_id) institution_id, user_id
  FROM institution_members
  WHERE member_role IN ('owner', 'admin') AND status = 'active' AND user_id IS NOT NULL
  ORDER BY institution_id, created_at ASC
) sub
WHERE i.id = sub.institution_id
  AND i.owner_user_id IS NULL;

-- Promote those owners' membership rows to 'owner'
UPDATE institution_members m
SET member_role = 'owner'
FROM institutions i
WHERE i.owner_user_id = m.user_id
  AND i.id = m.institution_id
  AND m.member_role = 'admin'
  AND m.status = 'active';
