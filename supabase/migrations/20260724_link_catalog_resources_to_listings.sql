-- Link catalog seed resources to their approved marketplace listings so MoMo checkout resolves.
UPDATE marketplace_resources mr
SET listing_id = ml.id
FROM marketplace_listings ml
WHERE mr.listing_id IS NULL
  AND ml.status = 'approved'
  AND ml.title = mr.title;
