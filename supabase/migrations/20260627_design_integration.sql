-- Engage Team Mode schema (additive)

CREATE TABLE IF NOT EXISTS engage_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES engage_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  letter TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2E2886',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES engage_teams(id) ON DELETE SET NULL;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS team_vote TEXT;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE session_responses ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES engage_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_engage_teams_session ON engage_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_team ON session_participants(team_id);

-- User invites (admin user management)
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  department TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_invites_institution ON user_invites(institution_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Marketplace
CREATE TABLE IF NOT EXISTS marketplace_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'lesson_plan',
  subject TEXT,
  level TEXT,
  description TEXT,
  price_ghs NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  import_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES marketplace_resources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES marketplace_resources(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_resources_status ON marketplace_resources(status);
