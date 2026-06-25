-- SphereSDS Database Schema
-- Run this in the Supabase SQL editor

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Institutions
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'school', -- 'school', 'corporate', 'training_center'
  logo_url TEXT,
  modules JSONB DEFAULT '{"engage":true,"assess":true,"learn":true,"train":true}',
  subscription_plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'teacher', -- 'admin','teacher','student','hr','employee'
  avatar_initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- ENGAGE MODE
-- =====================

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  questions JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  join_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'lobby', -- 'lobby','active','paused','ended'
  current_question_index INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES engage_sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  rank INTEGER,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES engage_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES session_participants(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  answer TEXT,
  is_correct BOOLEAN,
  response_time_ms INTEGER,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- ASSESS MODE
-- =====================

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  duration_minutes INTEGER DEFAULT 60,
  questions JSONB DEFAULT '[]',
  instructions TEXT,
  settings JSONB DEFAULT '{}',
  total_marks INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  class_name TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled', -- 'scheduled','active','grading','completed'
  join_code TEXT UNIQUE,
  invigilator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  answers JSONB DEFAULT '{}',
  score INTEGER,
  percentage NUMERIC(5,2),
  grade TEXT,
  feedback TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  integrity_flags JSONB DEFAULT '[]',
  result_status TEXT NOT NULL DEFAULT 'normal', -- 'normal','disqualified','withheld','voided'
  result_note TEXT,
  ticket_id UUID
);

-- =====================
-- ROSTERS (private/registered audiences for Assess + Learn)
-- =====================

CREATE TABLE IF NOT EXISTS rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID REFERENCES rosters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  groups TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active', -- 'active','pending'
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(roster_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_members_roster ON roster_members(roster_id);
CREATE INDEX IF NOT EXISTS idx_roster_members_user ON roster_members(user_id);

-- Audience controls on exams: who may take it
ALTER TABLE exams ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'open'; -- 'open','roster_login','roster_ticket'
ALTER TABLE exams ADD COLUMN IF NOT EXISTS roster_id UUID REFERENCES rosters(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS audience_groups TEXT[];

-- One ticket per (session, student) for passwordless, identity-bound access
CREATE TABLE IF NOT EXISTS exam_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  redeemed_at TIMESTAMPTZ,
  exam_submission_id UUID REFERENCES exam_submissions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_tickets_code ON exam_tickets(code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_exam_submissions_ticket'
  ) THEN
    ALTER TABLE exam_submissions ADD CONSTRAINT fk_exam_submissions_ticket FOREIGN KEY (ticket_id) REFERENCES exam_tickets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- LEARN MODE
-- =====================

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  thumbnail_color TEXT DEFAULT '#2BA888',
  modules JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT false,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A course can be tied to a roster (optionally a subset of its groups) so a
-- teacher can bulk-enroll their class in one action instead of inviting
-- students one by one. No ticket variant here — Learn has no public join
-- code, enrollment is always teacher-initiated.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS roster_id UUID REFERENCES rosters(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS audience_groups TEXT[];

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0,
  completed_modules JSONB DEFAULT '[]',
  current_module_index INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(course_id, student_id)
);

-- =====================
-- TRAIN MODE
-- =====================

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  steps JSONB DEFAULT '[]',
  is_mandatory BOOLEAN DEFAULT false,
  due_date DATE,
  assigned_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS path_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0,
  completed_steps JSONB DEFAULT '[]',
  certificate_issued_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(path_id, employee_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_enrollment_id UUID REFERENCES path_enrollments(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  path_title TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  certificate_number TEXT UNIQUE DEFAULT 'SPH-' || to_char(now(), 'YYYY') || '-' || floor(random()*900000+100000)::text
);

CREATE TABLE IF NOT EXISTS pulse_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX IF NOT EXISTS idx_quizzes_institution ON quizzes(institution_id);
CREATE INDEX IF NOT EXISTS idx_engage_sessions_code ON engage_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_engage_sessions_quiz ON engage_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_exams_institution ON exams(institution_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_code ON exam_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_courses_institution ON courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_institution ON learning_paths(institution_id);
CREATE INDEX IF NOT EXISTS idx_path_enrollments_employee ON path_enrollments(employee_id);

-- =====================
-- SEED DATA
-- =====================

INSERT INTO institutions (id, name, type, subscription_plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Kumasi JHS', 'school', 'growth')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, institution_id, name, email, role, avatar_initials)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ama Owusu', 'ama@kumasijhs.edu.gh', 'teacher', 'AO'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Kwame Asante', 'kwame@kumasijhs.edu.gh', 'teacher', 'KA'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Efua Mensah', 'efua@student.kumasijhs.edu.gh', 'student', 'EM'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Kofi Boateng', 'kofi@student.kumasijhs.edu.gh', 'student', 'KB')
ON CONFLICT DO NOTHING;
