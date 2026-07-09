-- Institution plan: GHS 1000 per quarter
UPDATE subscription_plans
SET price_ghs = 1000,
    billing_period = 'quarterly'
WHERE id = 'institution';

-- Reconcile creation_usage used counts from actual personal resources (institution_id IS NULL)
UPDATE creation_usage cu
SET learn_used = GREATEST(cu.learn_used, src.cnt),
    updated_at = now()
FROM (
  SELECT creator_id AS user_id, COUNT(*)::int AS cnt
  FROM courses
  WHERE institution_id IS NULL
  GROUP BY creator_id
) src
WHERE cu.user_id = src.user_id;

UPDATE creation_usage cu
SET engage_used = GREATEST(cu.engage_used, src.cnt),
    updated_at = now()
FROM (
  SELECT creator_id AS user_id, COUNT(*)::int AS cnt
  FROM quizzes
  WHERE institution_id IS NULL
  GROUP BY creator_id
) src
WHERE cu.user_id = src.user_id;

UPDATE creation_usage cu
SET train_used = GREATEST(cu.train_used, src.cnt),
    updated_at = now()
FROM (
  SELECT creator_id AS user_id, COUNT(*)::int AS cnt
  FROM learning_paths
  WHERE institution_id IS NULL
  GROUP BY creator_id
) src
WHERE cu.user_id = src.user_id;

UPDATE creation_usage cu
SET assess_used = GREATEST(cu.assess_used, src.cnt),
    updated_at = now()
FROM (
  SELECT creator_id AS user_id, COUNT(*)::int AS cnt
  FROM exams
  WHERE institution_id IS NULL
  GROUP BY creator_id
) src
WHERE cu.user_id = src.user_id;
