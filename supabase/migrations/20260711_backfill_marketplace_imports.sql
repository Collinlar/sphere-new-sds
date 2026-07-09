-- Backfill marketplace_imports for content copied without an acquisition row

INSERT INTO marketplace_imports (resource_id, institution_id, imported_by, imported_at)
SELECT
  (q.settings->>'imported_from_marketplace')::uuid,
  q.institution_id,
  q.creator_id,
  q.created_at
FROM quizzes q
WHERE q.settings->>'imported_from_marketplace' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_imports mi
    WHERE mi.resource_id = (q.settings->>'imported_from_marketplace')::uuid
      AND (
        (mi.institution_id IS NULL AND q.institution_id IS NULL AND mi.imported_by = q.creator_id)
        OR (mi.institution_id = q.institution_id)
      )
  )
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_imports (resource_id, institution_id, imported_by, imported_at)
SELECT
  (e.settings->>'imported_from_marketplace')::uuid,
  e.institution_id,
  e.creator_id,
  e.created_at
FROM exams e
WHERE e.settings->>'imported_from_marketplace' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_imports mi
    WHERE mi.resource_id = (e.settings->>'imported_from_marketplace')::uuid
      AND (
        (mi.institution_id IS NULL AND e.institution_id IS NULL AND mi.imported_by = e.creator_id)
        OR (mi.institution_id = e.institution_id)
      )
  )
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_imports (listing_id, institution_id, imported_by, imported_at)
SELECT
  (q.settings->>'imported_from_listing')::uuid,
  q.institution_id,
  q.creator_id,
  q.created_at
FROM quizzes q
WHERE q.settings->>'imported_from_listing' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_imports mi
    WHERE mi.listing_id = (q.settings->>'imported_from_listing')::uuid
      AND (
        (mi.institution_id IS NULL AND q.institution_id IS NULL AND mi.imported_by = q.creator_id)
        OR (mi.institution_id = q.institution_id)
      )
  )
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_imports (listing_id, institution_id, imported_by, imported_at)
SELECT
  c.marketplace_listing_id,
  c.institution_id,
  c.creator_id,
  c.created_at
FROM courses c
WHERE c.marketplace_listing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_imports mi
    WHERE mi.listing_id = c.marketplace_listing_id
      AND (
        (mi.institution_id IS NULL AND c.institution_id IS NULL AND mi.imported_by = c.creator_id)
        OR (mi.institution_id = c.institution_id)
      )
  )
ON CONFLICT DO NOTHING;

-- Legacy personal course copies without marketplace_listing_id: match by title
INSERT INTO marketplace_imports (resource_id, institution_id, imported_by, imported_at)
SELECT
  mr.id,
  c.institution_id,
  c.creator_id,
  c.created_at
FROM courses c
JOIN marketplace_resources mr ON mr.title = c.title AND mr.resource_type = 'lesson_plan'
WHERE c.institution_id IS NULL
  AND c.creator_id IS NOT NULL
  AND c.marketplace_listing_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_imports mi
    WHERE mi.resource_id = mr.id
      AND mi.institution_id IS NULL
      AND mi.imported_by = c.creator_id
  )
ON CONFLICT DO NOTHING;
