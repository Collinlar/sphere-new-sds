-- Rollout phase 2+: payments, RLS hardening, marketplace backfill helper

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  intent_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  amount_pesewas INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_reference ON payment_intents(reference);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_intents_select_own ON payment_intents;
CREATE POLICY payment_intents_select_own ON payment_intents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes only via service role (API routes)

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_subscriptions_select_own ON user_subscriptions;
CREATE POLICY user_subscriptions_select_own ON user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE user_add_ons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_add_ons_select_own ON user_add_ons;
CREATE POLICY user_add_ons_select_own ON user_add_ons
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE marketplace_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_purchases_select_own ON marketplace_purchases;
CREATE POLICY marketplace_purchases_select_own ON marketplace_purchases
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- Backfill legacy marketplace_resources into listings where missing
INSERT INTO marketplace_listings (
  creator_id, title, description, resource_type, resource_id,
  price_ghs, is_free, subject, target_levels, status, thumbnail_color, created_at, updated_at
)
SELECT
  mr.creator_id,
  mr.title,
  mr.description,
  CASE mr.resource_type
    WHEN 'lesson_plan' THEN 'course'
    WHEN 'question_bank' THEN 'exam'
    WHEN 'engage_game' THEN 'quiz'
    WHEN 'train_track' THEN 'training_path'
    ELSE 'document'
  END,
  COALESCE((mr.metadata->>'backing_resource_id')::uuid, mr.id),
  COALESCE(mr.price_ghs, 0),
  COALESCE(mr.price_ghs, 0) = 0 OR mr.price_ghs IS NULL,
  mr.subject,
  CASE WHEN mr.level IS NOT NULL THEN ARRAY[mr.level] ELSE NULL END,
  CASE mr.status
    WHEN 'published' THEN 'approved'
    WHEN 'pending_review' THEN 'pending_review'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'draft'
  END,
  '#1A8966',
  mr.created_at,
  mr.updated_at
FROM marketplace_resources mr
WHERE mr.listing_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_listings ml
    WHERE ml.creator_id = mr.creator_id
      AND ml.title = mr.title
      AND ml.created_at = mr.created_at
  );

UPDATE marketplace_resources mr
SET listing_id = ml.id
FROM marketplace_listings ml
WHERE mr.listing_id IS NULL
  AND ml.creator_id = mr.creator_id
  AND ml.title = mr.title
  AND ml.created_at = mr.created_at;
