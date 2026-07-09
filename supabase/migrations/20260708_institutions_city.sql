-- Institution profile fields used by create-institution and admin panels

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_institutions_owner_user ON institutions(owner_user_id);
