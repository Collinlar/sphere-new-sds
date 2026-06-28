-- Train module fixes: assigned departments on learning paths

ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS assigned_departments JSONB DEFAULT '["All staff"]'::jsonb;
