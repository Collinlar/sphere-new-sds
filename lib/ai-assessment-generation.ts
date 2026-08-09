import type { ExamQuestion } from './types'

export type QuestionTypeKey = 'mcq' | 'true_false' | 'short' | 'essay'
export type MixPreset = 'all_mcq' | 'bece' | 'balanced' | 'custom'
export type Difficulty = 'foundation' | 'standard' | 'challenge'
export type ReplaceMode = 'replace' | 'append'

export interface TypeMix {
  mcq: number
  true_false: number
  short: number
  essay: number
}

export interface AssessmentAiConfig {
  topic: string
  detail: string
  subject: string
  gradeLevel: string
  totalCount: number
  mixPreset: MixPreset
  typeMix: TypeMix
  difficulty: Difficulty
  replaceMode: ReplaceMode
  /** Student-facing extras. On by default, off for sealed exam conditions. */
  includeHints: boolean
  includeExplanations: boolean
}

export const ASSESSMENT_SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Social Studies',
  'ICT',
  'French',
  'History',
  'Geography',
  'Religious Studies',
  'Physical Education',
]

export const MIX_PRESETS: { id: MixPreset; label: string; desc: string }[] = [
  { id: 'all_mcq', label: 'All multiple choice', desc: 'Objective test, fast to mark' },
  { id: 'bece', label: 'BECE-style', desc: 'Mostly MCQ with a few short answers' },
  { id: 'balanced', label: 'Balanced mix', desc: 'MCQ, true/false, short, and essay' },
  { id: 'custom', label: 'Custom mix', desc: 'Set the count for each question type' },
]

export const DIFFICULTY_OPTIONS: { id: Difficulty; label: string }[] = [
  { id: 'foundation', label: 'Foundation' },
  { id: 'standard', label: 'Standard' },
  { id: 'challenge', label: 'Challenge' },
]

export const DEFAULT_MARKS: Record<QuestionTypeKey, number> = {
  mcq: 2,
  true_false: 1,
  short: 4,
  essay: 10,
}

export const MIN_QUESTIONS = 3
export const MAX_QUESTIONS = 30

export function mixTotal(mix: TypeMix): number {
  return mix.mcq + mix.true_false + mix.short + mix.essay
}

export function mixForPreset(preset: MixPreset, total: number): TypeMix {
  const n = Math.max(1, Math.min(MAX_QUESTIONS, total))
  if (preset === 'all_mcq') {
    return { mcq: n, true_false: 0, short: 0, essay: 0 }
  }
  if (preset === 'bece') {
    const short = n >= 5 ? Math.max(1, Math.round(n * 0.2)) : 0
    return { mcq: n - short, true_false: 0, short, essay: 0 }
  }
  if (preset === 'balanced') {
    if (n <= 4) return { mcq: n, true_false: 0, short: 0, essay: 0 }
    const essay = n >= 10 ? Math.max(1, Math.floor(n * 0.1)) : 0
    const short = Math.max(1, Math.floor(n * 0.15))
    const true_false = n >= 6 ? Math.max(1, Math.floor(n * 0.1)) : 0
    const mcq = Math.max(0, n - essay - short - true_false)
    return { mcq, true_false, short, essay }
  }
  return { mcq: n, true_false: 0, short: 0, essay: 0 }
}

export function defaultAssessmentAiConfig(
  subject = '',
  gradeLevel = ''
): AssessmentAiConfig {
  const totalCount = 10
  return {
    topic: '',
    detail: '',
    subject,
    gradeLevel,
    totalCount,
    mixPreset: 'bece',
    typeMix: mixForPreset('bece', totalCount),
    difficulty: 'standard',
    replaceMode: 'replace',
    includeHints: true,
    includeExplanations: true,
  }
}

export function validateAssessmentAiConfig(
  config: AssessmentAiConfig
): { ok: true } | { ok: false; error: string } {
  if (!config.topic.trim()) {
    return { ok: false, error: 'Add a topic or syllabus area first.' }
  }
  if (!config.subject.trim()) {
    return { ok: false, error: 'Pick a subject so the questions match your exam.' }
  }
  if (!config.gradeLevel.trim()) {
    return { ok: false, error: 'Pick a level so wording fits your students.' }
  }
  const total = mixTotal(config.typeMix)
  if (total < MIN_QUESTIONS) {
    return { ok: false, error: `Add at least ${MIN_QUESTIONS} questions across your mix.` }
  }
  if (total > MAX_QUESTIONS) {
    return { ok: false, error: `Keep the total at ${MAX_QUESTIONS} questions or fewer.` }
  }
  if (config.mixPreset !== 'custom' && total !== config.totalCount) {
    return { ok: false, error: 'Question mix does not match your total. Pick a preset again or switch to custom.' }
  }
  return { ok: true }
}

function mixSummary(mix: TypeMix): string[] {
  const parts: string[] = []
  if (mix.mcq) parts.push(`${mix.mcq} multiple choice`)
  if (mix.true_false) parts.push(`${mix.true_false} true/false`)
  if (mix.short) parts.push(`${mix.short} short answer`)
  if (mix.essay) parts.push(`${mix.essay} essay`)
  return parts
}

export function buildAssessmentAiPreview(config: AssessmentAiConfig): {
  headline: string
  lines: string[]
  estimatedMarks: number
} {
  const total = mixTotal(config.typeMix)
  const mixParts = mixSummary(config.typeMix)
  const estimatedMarks =
    config.typeMix.mcq * DEFAULT_MARKS.mcq +
    config.typeMix.true_false * DEFAULT_MARKS.true_false +
    config.typeMix.short * DEFAULT_MARKS.short +
    config.typeMix.essay * DEFAULT_MARKS.essay

  const difficultyLabel =
    DIFFICULTY_OPTIONS.find(d => d.id === config.difficulty)?.label ?? 'Standard'

  const lines = [
    `Topic: ${config.topic.trim()}`,
    mixParts.length ? `Mix: ${mixParts.join(', ')}` : 'Mix: not set yet',
    `Difficulty: ${difficultyLabel}`,
    `Style: Ghanaian classroom, BECE-aligned wording`,
    `Est. marks: about ${estimatedMarks} (${DEFAULT_MARKS.mcq} per MCQ, ${DEFAULT_MARKS.short} per short, ${DEFAULT_MARKS.essay} per essay)`,
  ]

  if (config.detail.trim()) {
    lines.splice(1, 0, `Syllabus notes: ${config.detail.trim().slice(0, 120)}${config.detail.length > 120 ? '...' : ''}`)
  }

  return {
    headline: `${total} question${total === 1 ? '' : 's'} for ${config.gradeLevel || 'your level'} · ${config.subject || 'your subject'}`,
    lines,
    estimatedMarks,
  }
}

export function loadingMessageForConfig(config: AssessmentAiConfig): string {
  const total = mixTotal(config.typeMix)
  const topic = config.topic.trim()
  return `Drafting ${total} question${total === 1 ? '' : 's'} on ${topic} for ${config.gradeLevel} ${config.subject}...`
}

/**
 * Resolve a model-supplied answer key against the real option labels.
 * Handles "A", "a", "A)", "A.", "Option A", and the full option text.
 * Returns null when it cannot be resolved, so the caller flags the question
 * instead of inventing a key.
 */
export function resolveCorrectLabel(
  rawCorrect: unknown,
  options: { label: string; text: string }[]
): string | null {
  if (rawCorrect == null || !options.length) return null
  const raw = String(rawCorrect).trim()
  if (!raw) return null

  // Direct label match, case insensitive, ignoring trailing punctuation.
  const stripped = raw.replace(/^option\s+/i, '').replace(/[).:\s]+$/, '').trim()
  const byLabel = options.find(o => o.label.toLowerCase() === stripped.toLowerCase())
  if (byLabel) return byLabel.label

  // The model sometimes returns the option text rather than its label.
  const byText = options.find(o => o.text.trim().toLowerCase() === raw.toLowerCase())
  if (byText) return byText.label

  // A 0-based or 1-based index.
  if (/^\d+$/.test(stripped)) {
    const n = Number(stripped)
    if (options[n]) return options[n].label
    if (options[n - 1]) return options[n - 1].label
  }

  return null
}

export interface NormalizedQuestions {
  questions: ExamQuestion[]
  /** Questions whose answer key could not be trusted, for a visible warning. */
  flagged: number
}

export function normalizeGeneratedQuestions(
  raw: ExamQuestion[],
  mix: TypeMix
): NormalizedQuestions {
  const marksByType = DEFAULT_MARKS
  let flagged = 0

  const questions = raw.map(q => {
    const type = q.type ?? 'mcq'
    const base = {
      id: q.id || crypto.randomUUID(),
      type,
      text: q.text ?? '',
      marks: q.marks ?? marksByType[type as QuestionTypeKey] ?? 2,
      hint: q.hint,
      explanation: q.explanation,
      rubric: q.rubric,
    }

    if (type === 'mcq' || type === 'true_false') {
      const fallback = type === 'true_false'
        ? [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }]
        : [
            { label: 'A', text: '' },
            { label: 'B', text: '' },
            { label: 'C', text: '' },
            { label: 'D', text: '' },
          ]
      const options = q.options?.length ? q.options : fallback
      const resolved = resolveCorrectLabel(q.correct, options)

      if (!resolved) {
        // Never invent an answer key. Flag it for the teacher instead.
        flagged++
        return {
          ...base,
          options,
          correct: undefined,
          needs_review: 'Confirm the correct answer for this question.',
        }
      }
      return { ...base, options, correct: resolved }
    }

    // Written answers carry a rubric instead of a key. Missing rubric on a
    // marked essay is real work handed back, so flag it.
    const needsRubric = type === 'essay' && !q.rubric?.trim()
    if (needsRubric) flagged++
    return {
      ...base,
      options: undefined,
      correct: q.correct,
      needs_review: needsRubric ? 'Add a mark scheme for this essay.' : undefined,
    }
  })

  return { questions, flagged }
}

export function configToApiContext(config: AssessmentAiConfig): Record<string, unknown> {
  return {
    subject: config.subject,
    gradeLevel: config.gradeLevel,
    count: mixTotal(config.typeMix),
    detail: config.detail.trim() || undefined,
    typeMix: config.typeMix,
    difficulty: config.difficulty,
    marksPerType: DEFAULT_MARKS,
    includeHints: config.includeHints,
    includeExplanations: config.includeExplanations,
  }
}
