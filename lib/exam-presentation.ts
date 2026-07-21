import type { ExamQuestion } from '@/lib/types'

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function remapOptions(q: ExamQuestion): ExamQuestion {
  if (!q.options?.length || q.type === 'short' || q.type === 'essay') return { ...q }

  const originalCorrectText = q.options.find((o) => o.label === q.correct)?.text
  const shuffled = shuffleInPlace([...q.options.map((o) => ({ ...o }))])
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']
  const remapped = shuffled.map((opt, i) => ({
    label: labels[i] ?? String(i + 1),
    text: opt.text,
  }))
  const correct = remapped.find((o) => o.text === originalCorrectText)?.label ?? q.correct

  return { ...q, options: remapped, correct }
}

/** Build a per-student presentation of exam questions with optional shuffle. */
export function buildExamPresentation(
  questions: ExamQuestion[],
  settings: Record<string, unknown> | null | undefined,
): ExamQuestion[] {
  const shuffleQuestions = Boolean(settings?.shuffle_questions)
  const shuffleOptions = Boolean(settings?.shuffle_options)

  let ordered = questions.map((q) => ({ ...q, options: q.options ? q.options.map((o) => ({ ...o })) : undefined }))
  if (shuffleQuestions) ordered = shuffleInPlace([...ordered])
  if (shuffleOptions) ordered = ordered.map(remapOptions)
  return ordered
}

export function remainingExamSeconds(params: {
  startedAt: string
  durationMinutes: number
  sessionExtraSeconds?: number
  submissionExtraSeconds?: number
}): number {
  const base = params.durationMinutes * 60
  const extra = (params.sessionExtraSeconds ?? 0) + (params.submissionExtraSeconds ?? 0)
  const elapsed = Math.floor((Date.now() - new Date(params.startedAt).getTime()) / 1000)
  return Math.max(0, base + extra - elapsed)
}
