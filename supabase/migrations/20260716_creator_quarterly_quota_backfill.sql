-- Backfill Creator Quarterly users whose creation pool was never seeded on upgrade.
-- Payment fulfillment previously upserted without onConflict on user_id, so existing
-- membership rows kept stale quotas (e.g. 0/5/0/0 instead of 10/10/10/10).

UPDATE creation_usage cu
SET
  assess_quota = 10,
  engage_quota = 10,
  learn_quota = 10,
  train_quota = 10,
  updated_at = now()
FROM users u
WHERE cu.user_id = u.id
  AND u.subscription_tier = 'creator_quarterly'
  AND (
    cu.assess_quota + cu.engage_quota + cu.learn_quota + cu.train_quota <> 40
    OR cu.assess_quota = 0
    OR cu.learn_quota = 0
    OR cu.train_quota = 0
  );

-- Ensure every creator_quarterly user has a usage row.
INSERT INTO creation_usage (user_id, assess_quota, engage_quota, learn_quota, train_quota)
SELECT u.id, 10, 10, 10, 10
FROM users u
WHERE u.subscription_tier = 'creator_quarterly'
  AND NOT EXISTS (
    SELECT 1 FROM creation_usage cu WHERE cu.user_id = u.id
  );
