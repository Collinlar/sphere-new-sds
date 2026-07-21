const PREFIX = 'sphere_exam_answers:'

export interface ExamAnswerCache {
  answers: Record<string, string>
  activeQuestionId?: string
  updatedAt: string
}

export function examCacheKey(submissionId: string) {
  return `${PREFIX}${submissionId}`
}

export function loadExamAnswers(submissionId: string): ExamAnswerCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(examCacheKey(submissionId))
    if (!raw) return null
    return JSON.parse(raw) as ExamAnswerCache
  } catch {
    return null
  }
}

export function saveExamAnswers(
  submissionId: string,
  answers: Record<string, string>,
  activeQuestionId?: string,
) {
  if (typeof window === 'undefined') return
  const payload: ExamAnswerCache = {
    answers,
    activeQuestionId,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(examCacheKey(submissionId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearExamAnswers(submissionId: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(examCacheKey(submissionId))
  } catch {
    /* noop */
  }
}
