import type { Exam, ExamSubmission } from '@/lib/types'

/** Show "Set up my account" only for roster students who took a ticketed exam without signing in. */
export function shouldOfferAccountSetup(
  submission: ExamSubmission,
  exam: Exam | null,
  studentEmail: string | null,
  loggedInUserId: string | null | undefined,
): boolean {
  if (!submission.student_id || !studentEmail) return false
  if (loggedInUserId === submission.student_id) return false
  if (submission.ticket_id) return true
  if (exam?.audience === 'roster_ticket') return true
  return false
}
