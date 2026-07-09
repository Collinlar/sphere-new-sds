-- Per-resource certificate toggle for exams and courses (from certificates_general.sql)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS issues_certificate BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS issues_certificate BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS certificate_pass_mark INT DEFAULT 50;
