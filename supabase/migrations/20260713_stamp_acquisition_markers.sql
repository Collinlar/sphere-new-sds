-- Stamp acquisition markers on content copied before marketplace_listing_id was set

UPDATE marketplace_imports mi
SET listing_id = ml.id
FROM marketplace_resources mr
JOIN marketplace_listings ml ON ml.title = mr.title
WHERE mi.listing_id IS NULL
  AND mi.resource_id = mr.id
  AND (
    (mr.resource_type = 'lesson_plan' AND ml.resource_type = 'course')
    OR (mr.resource_type = 'engage_game' AND ml.resource_type = 'quiz')
    OR (mr.resource_type = 'question_bank' AND ml.resource_type = 'exam')
    OR (mr.resource_type = 'train_track' AND ml.resource_type = 'training_path')
  );

UPDATE courses c
SET marketplace_listing_id = mi.listing_id
FROM marketplace_imports mi
JOIN marketplace_resources mr ON mr.id = mi.resource_id
WHERE c.marketplace_listing_id IS NULL
  AND mi.listing_id IS NOT NULL
  AND mr.resource_type = 'lesson_plan'
  AND c.title = mr.title
  AND c.creator_id = mi.imported_by
  AND (
    (c.institution_id IS NULL AND mi.institution_id IS NULL)
    OR c.institution_id = mi.institution_id
  );

UPDATE courses c
SET marketplace_listing_id = mi.listing_id
FROM marketplace_imports mi
WHERE c.marketplace_listing_id IS NULL
  AND mi.listing_id IS NOT NULL
  AND c.creator_id = mi.imported_by
  AND c.created_at = mi.imported_at
  AND (
    (c.institution_id IS NULL AND mi.institution_id IS NULL)
    OR c.institution_id = mi.institution_id
  );

UPDATE learning_paths lp
SET marketplace_listing_id = mi.listing_id
FROM marketplace_imports mi
JOIN marketplace_resources mr ON mr.id = mi.resource_id
WHERE lp.marketplace_listing_id IS NULL
  AND mi.listing_id IS NOT NULL
  AND mr.resource_type = 'train_track'
  AND lp.title = mr.title
  AND lp.creator_id = mi.imported_by
  AND (
    (lp.institution_id IS NULL AND mi.institution_id IS NULL)
    OR lp.institution_id = mi.institution_id
  );

UPDATE quizzes q
SET marketplace_listing_id = mi.listing_id
FROM marketplace_imports mi
WHERE q.marketplace_listing_id IS NULL
  AND mi.listing_id IS NOT NULL
  AND q.creator_id = mi.imported_by
  AND (
    q.settings->>'imported_from_listing' = mi.listing_id::text
    OR q.created_at = mi.imported_at
  )
  AND (
    (q.institution_id IS NULL AND mi.institution_id IS NULL)
    OR q.institution_id = mi.institution_id
  );

UPDATE exams e
SET marketplace_listing_id = mi.listing_id
FROM marketplace_imports mi
WHERE e.marketplace_listing_id IS NULL
  AND mi.listing_id IS NOT NULL
  AND e.creator_id = mi.imported_by
  AND (
    e.settings->>'imported_from_listing' = mi.listing_id::text
    OR e.created_at = mi.imported_at
  )
  AND (
    (e.institution_id IS NULL AND mi.institution_id IS NULL)
    OR e.institution_id = mi.institution_id
  );
