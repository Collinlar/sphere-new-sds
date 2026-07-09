import { gradeFromPercentage } from './utils'
import type { Exam, ExamQuestion, ExamSubmission } from './types'

export function computeObjectiveScore(
  questions: ExamQuestion[],
  answers: Record<string, string> | undefined
): number {
  return questions.reduce((total, q) => {
    if (q.type === 'mcq' || q.type === 'true_false') {
      const ans = answers?.[q.id]
      if (ans === q.correct) return total + q.marks
    }
    return total
  }, 0)
}

export function computeMaxMarks(questions: ExamQuestion[]): number {
  return questions.reduce((sum, q) => sum + q.marks, 0)
}

export function scoreObjectiveQuestions(
  exam: Pick<Exam, 'questions'>,
  answers: Record<string, string> | undefined
): { score: number; maxMarks: number; percentage: number; grade: string } {
  const maxMarks = computeMaxMarks(exam.questions)
  const score = computeObjectiveScore(exam.questions, answers)
  const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0
  return {
    score,
    maxMarks,
    percentage,
    grade: gradeFromPercentage(percentage),
  }
}

/** Back-compat for grading page */
export function computeAutoScore(sub: ExamSubmission, exam: Exam | null): number {
  if (!exam) return 0
  return computeObjectiveScore(exam.questions, sub.answers)
}
