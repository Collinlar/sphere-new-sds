-- Ensure content tables can stamp marketplace acquisition markers.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS marketplace_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_marketplace_listing ON exams(marketplace_listing_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_marketplace_listing ON quizzes(marketplace_listing_id);
CREATE INDEX IF NOT EXISTS idx_courses_marketplace_listing ON courses(marketplace_listing_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_marketplace_listing ON learning_paths(marketplace_listing_id);
