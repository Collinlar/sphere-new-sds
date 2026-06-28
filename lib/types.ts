export type UserRole = 'admin' | 'teacher' | 'student' | 'hr' | 'employee'
export type Mode = 'engage' | 'assess' | 'learn' | 'train' | 'platform'
export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise'

export interface Institution {
  id: string
  name: string
  type: string
  logo_url?: string
  modules: Record<Mode, boolean>
  subscription_plan: SubscriptionPlan
  created_at: string
}

export interface User {
  id: string
  institution_id: string
  name: string
  email?: string
  role: UserRole
  avatar_initials: string
  department?: string
  created_at: string
}

// Engage
export type QuestionType = 'mcq' | 'true_false' | 'multi_select' | 'short_answer' | 'poll'

export interface QuizQuestion {
  id: string
  type: QuestionType
  text: string
  options: { label: string; text: string }[]
  correct: string        // single answer for mcq / true_false
  correct_multiple: string[] // for multi_select
  correct_text?: string  // for short_answer
  time_seconds: number
  points: number
  image_url?: string
}

export interface Quiz {
  id: string
  institution_id: string
  creator_id: string
  title: string
  description?: string
  subject?: string
  grade_level?: string
  questions: QuizQuestion[]
  settings: Record<string, unknown>
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface EngageSession {
  id: string
  quiz_id: string
  host_id: string
  join_code: string
  status: 'lobby' | 'active' | 'paused' | 'ended'
  current_question_index: number
  settings: Record<string, unknown>
  started_at?: string
  ended_at?: string
  created_at: string
}

export interface SessionParticipant {
  id: string
  session_id: string
  display_name: string
  score: number
  streak: number
  joined_at: string
  team_id?: string | null
  team_vote?: string | null
}

export interface EngageTeam {
  id: string
  session_id: string
  name: string
  letter: string
  color: string
  score: number
  created_at?: string
}

// Assess
export interface ExamQuestion {
  id: string
  type: 'mcq' | 'short' | 'essay' | 'true_false'
  text: string
  options?: { label: string; text: string }[]
  correct?: string
  marks: number
  rubric?: string
  explanation?: string
}

export type ExamAudience = 'open' | 'roster_login' | 'roster_ticket'

export interface Exam {
  id: string
  institution_id: string
  creator_id: string
  title: string
  subject?: string
  grade_level?: string
  duration_minutes: number
  questions: ExamQuestion[]
  instructions?: string
  settings: Record<string, unknown>
  is_published: boolean
  created_at: string
  audience: ExamAudience
  roster_id?: string
  audience_groups?: string[]
}

export interface ExamSession {
  id: string
  exam_id: string
  class_name?: string
  scheduled_at?: string
  status: 'scheduled' | 'active' | 'grading' | 'completed'
  join_code?: string
  invigilator_id?: string
  created_at: string
}

export interface ExamSubmission {
  id: string
  exam_session_id: string
  student_id?: string
  student_name: string
  ticket_id?: string
  answers: Record<string, string>
  score?: number
  percentage?: number
  grade?: string
  feedback?: string
  started_at: string
  submitted_at?: string
  integrity_flags: string[]
  result_status?: 'normal' | 'disqualified' | 'withheld' | 'voided'
  result_note?: string
}

// Rosters (private/registered audiences for Assess + Learn)
export interface Roster {
  id: string
  institution_id: string
  creator_id: string
  name: string
  invite_code?: string
  created_at: string
}

export interface RosterMember {
  id: string
  roster_id: string
  user_id: string
  groups: string[]
  status: 'active' | 'pending'
  added_at: string
  users?: User
}

export interface ExamTicket {
  id: string
  exam_session_id: string
  user_id: string
  code: string
  redeemed_at?: string
  exam_submission_id?: string
  created_at: string
}

// Learn
export interface CourseModule {
  id: string
  title: string
  type: 'video' | 'reading' | 'quiz' | 'assignment' | 'flashcards'
  content: Record<string, unknown>
  duration_minutes?: number
}

export interface Course {
  id: string
  institution_id: string
  creator_id: string
  title: string
  description?: string
  subject?: string
  grade_level?: string
  thumbnail_color: string
  modules: CourseModule[]
  is_published: boolean
  created_at: string
  roster_id?: string | null
  audience_groups?: string[] | null
}

export interface Enrollment {
  id: string
  course_id: string
  student_id: string
  progress_percentage: number
  completed_modules: string[]
  enrolled_at: string
  completed_at?: string
}

// Train
export interface PathStep {
  id: string
  title: string
  type: 'video' | 'reading' | 'quiz' | 'sign_off' | 'assessment'
  content: Record<string, unknown>
  duration_minutes?: number
  is_mandatory: boolean
}

export interface LearningPath {
  id: string
  institution_id: string
  creator_id: string
  title: string
  description?: string
  category?: string
  steps: PathStep[]
  is_mandatory: boolean
  due_date?: string
  assigned_departments?: string[]
  assigned_count?: number
  created_at: string
}

export interface PathEnrollment {
  id: string
  path_id: string
  employee_id: string
  progress_percentage: number
  completed_steps: string[]
  certificate_issued_at?: string
  enrolled_at: string
}
