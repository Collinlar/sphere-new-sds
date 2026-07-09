-- Membership free tier: Engage only (5 live sessions, 5 students per session).
-- Assess, Learn, and Train reserved for Creator and Institution plans.

UPDATE subscription_plans
SET
  assess_quota = 0,
  engage_quota = 5,
  learn_quota = 0,
  train_quota = 0
WHERE id = 'membership';

UPDATE creation_usage cu
SET assess_quota = 0
FROM users u
WHERE cu.user_id = u.id
  AND u.subscription_tier = 'membership'
  AND cu.assess_quota > 0;
