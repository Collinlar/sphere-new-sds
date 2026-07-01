export type UserRole = 'admin' | 'teacher' | 'student' | 'hr' | 'employee'
export type Mode = 'engage' | 'assess' | 'learn' | 'train' | 'platform'
// Legacy plan name type kept for Institution.subscription_plan column compatibility
export type LegacyPlanName = 'starter' | 'growth' | 'enterprise'

export interface Institution {
  id: string
  name: string
  type: string
  logo_url?: string
  modules: Record<Mode, boolean>
  subscription_plan: LegacyPlanName
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

// =====================
// SUBSCRIPTION & PLANS
// =====================

export type SubscriptionTier = 'membership' | 'creator_quarterly' | 'creator_marketplace' | 'institution'

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  price_ghs: number | null
  billing_period: 'quarterly' | 'monthly' | null
  assess_quota: number | null
  engage_quota: number | null
  learn_quota: number | null
  train_quota: number | null
  total_creation_pool: number | null
  session_student_cap: number | null
  enrolled_student_cap: number | null
  can_sell_marketplace: boolean
  marketplace_commission_rate: number
  can_issue_certificates: boolean
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: SubscriptionTier
  status: 'active' | 'cancelled' | 'expired' | 'suspended'
  started_at: string
  expires_at?: string
  payment_reference?: string
  created_at: string
}

export interface CreationUsage {
  id: string
  user_id: string
  assess_quota: number
  engage_quota: number
  learn_quota: number
  train_quota: number
  assess_used: number
  engage_used: number
  learn_used: number
  train_used: number
}

// =====================
// INSTITUTION TYPES
// =====================

export interface InstitutionLevel {
  id: string
  label: string
}

export interface InstitutionType {
  id: string
  name: string
  period_language: string
  period_count: number
  levels: InstitutionLevel[]
  academic_year_start_month: number
  is_custom: boolean
}

// =====================
// CREATOR PROFILES & MARKETPLACE
// =====================

export interface CreatorProfile {
  id: string
  user_id: string
  slug: string
  bio?: string
  tagline?: string
  avatar_url?: string
  banner_color: string
  is_approved: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  total_sales: number
  total_revenue_ghs: number
  marketplace_route_active: boolean
  created_at: string
}

export type MarketplaceResourceType = 'course' | 'exam' | 'quiz' | 'guide' | 'notes' | 'document' | 'training_path'
export type ListingStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended'

export interface MarketplaceListing {
  id: string
  creator_id: string
  title: string
  description?: string
  resource_type: MarketplaceResourceType
  resource_id: string
  price_ghs: number
  is_free: boolean
  is_entry_resource: boolean
  target_level_types?: string[]
  target_levels?: string[]
  subject?: string
  tags?: string[]
  status: ListingStatus
  admin_notes?: string
  approved_at?: string
  total_purchases: number
  total_revenue_ghs: number
  slug?: string
  thumbnail_color: string
  commission_rate?: number
  created_at: string
  updated_at: string
}

export interface MarketplacePurchase {
  id: string
  listing_id: string
  buyer_id: string
  price_ghs: number
  commission_rate: number
  commission_ghs: number
  creator_earnings_ghs: number
  payment_reference?: string
  payment_status: 'pending' | 'completed' | 'refunded'
  purchased_at: string
}

// =====================
// AI ADD-ONS
// =====================

export type AddOnId = 'ai_course_builder' | 'ai_assessment_builder' | 'ai_hints' | 'ai_explanations' | 'ai_training_builder'

export interface AddOn {
  id: AddOnId
  name: string
  description: string
  price_ghs: number | null
  billing_period: string
  eligible_plans: SubscriptionTier[]
  is_active: boolean
}

export interface UserAddOn {
  id: string
  user_id: string
  add_on_id: AddOnId
  status: 'active' | 'cancelled' | 'expired'
  started_at: string
  expires_at?: string
}

// =====================
// NEW CONTENT TYPES: GUIDES, NOTES, DOCUMENTS
// =====================

export interface GuideStep {
  id: string
  title: string
  body: string
  image_url?: string
  tip?: string
}

export interface Guide {
  id: string
  creator_id: string
  institution_id?: string
  title: string
  description?: string
  cover_color: string
  steps: GuideStep[]
  estimated_minutes?: number
  subject?: string
  grade_level?: string
  is_published: boolean
  marketplace_listing_id?: string
  created_at: string
  updated_at: string
}

export type NoteBlockType = 'text' | 'image' | 'video_link' | 'link' | 'callout'

export interface NoteBlock {
  id: string
  type: NoteBlockType
  content: Record<string, unknown>
}

export interface Note {
  id: string
  creator_id: string
  institution_id?: string
  title: string
  cover_color: string
  blocks: NoteBlock[]
  is_published: boolean
  is_downloadable: boolean
  subject?: string
  grade_level?: string
  marketplace_listing_id?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  creator_id: string
  institution_id?: string
  title: string
  cover_color: string
  content_type: 'editor' | 'upload'
  content?: Record<string, unknown>
  file_url?: string
  file_name?: string
  file_size_bytes?: number
  mime_type?: string
  is_published: boolean
  subject?: string
  grade_level?: string
  marketplace_listing_id?: string
  created_at: string
  updated_at: string
}

// =====================
// CERTIFICATES
// =====================

export interface CertificateTemplate {
  id: string
  owner_id: string
  owner_type: 'creator' | 'institution' | 'sphere'
  name: string
  template_type: 'sphere_default' | 'custom_upload'
  file_url?: string
  is_active: boolean
  created_at: string
}

export interface IssuedCertificate {
  id: string
  recipient_id: string
  issuer_id?: string
  template_id?: string
  resource_type: 'course' | 'exam' | 'training_path'
  resource_id: string
  resource_title: string
  issued_at: string
  certificate_url?: string
  verification_code: string
}

// =====================
// GUEST SESSION RECOVERY
// =====================

export interface GuestSession {
  id: string
  session_type: 'exam' | 'engage'
  resource_session_id: string
  submission_id?: string
  display_name?: string
  claim_token: string
  browser_token: string
  claimed_by?: string
  claimed_at?: string
  expires_at: string
  created_at: string
}

// =====================
// TRAIN
// =====================

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
