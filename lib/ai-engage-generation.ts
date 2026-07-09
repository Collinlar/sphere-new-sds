import type { QuestionType, QuizQuestion } from './types'

export type EngageMixPreset = 'mcq_blitz' | 'mixed_live' | 'true_false_sprint' | 'custom'
export type EngagePace = 'fast' | 'standard' | 'thoughtful'
export type ReplaceMode = 'replace' | 'append'

export interface EngageTypeMix {
  mcq: number
  true_false: number
  multi_select: number
  short_answer: number
  poll: number
}

export interface EngageAiConfig {
  topic: string
  detail: string
  subject: string
  gradeLevel: string
  totalCount: number
  mixPreset: EngageMixPreset
  typeMix: EngageTypeMix
  pace: EngagePace
  replaceMode: ReplaceMode
}

export const ENGAGE_SUBJECTS = [
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
  'General',
]

export const ENGAGE_MIX_PRESETS: { id: EngageMixPreset; label: string; desc: string }[] = [
  { id: 'mcq_blitz', label: 'MCQ blitz', desc: 'All multiple choice, fast classroom energy' },
  { id: 'mixed_live', label: 'Mixed live quiz', desc: 'MCQ, true/false, and a few multi-select' },
  { id: 'true_false_sprint', label: 'True/false sprint', desc: 'Quick true/false rounds' },
  { id: 'custom', label: 'Custom mix', desc: 'Set the count for each question type' },
]

export const ENGAGE_PACE_OPTIONS: { id: EngagePace; label: string; seconds: number }[] = [
  { id: 'fast', label: 'Fast', seconds: 15 },
  { id: 'standard', label: 'Standard', seconds: 20 },
  { id: 'thoughtful', label: 'Thoughtful', seconds: 30 },
]

export const MIN_ENGAGE_QUESTIONS = 3
export const MAX_ENGAGE_QUESTIONS = 25

export function engageMixTotal(mix: EngageTypeMix): number {
  return mix.mcq + mix.true_false + mix.multi_select + mix.short_answer + mix.poll
}

export function engageMixForPreset(preset: EngageMixPreset, total: number): EngageTypeMix {
  const n = Math.max(MIN_ENGAGE_QUESTIONS, Math.min(MAX_ENGAGE_QUESTIONS, total))
  if (preset === 'mcq_blitz') {
    return { mcq: n, true_false: 0, multi_select: 0, short_answer: 0, poll: 0 }
  }
  if (preset === 'true_false_sprint') {
    return { mcq: 0, true_false: n, multi_select: 0, short_answer: 0, poll: 0 }
  }
  if (preset === 'mixed_live') {
    if (n <= 4) return { mcq: n - 1, true_false: 1, multi_select: 0, short_answer: 0, poll: 0 }
    const true_false = Math.max(1, Math.round(n * 0.25))
    const multi_select = n >= 8 ? Math.max(1, Math.round(n * 0.15)) : 0
    const mcq = Math.max(1, n - true_false - multi_select)
    return { mcq, true_false, multi_select, short_answer: 0, poll: 0 }
  }
  return { mcq: n, true_false: 0, multi_select: 0, short_answer: 0, poll: 0 }
}

export function defaultEngageAiConfig(subject = '', gradeLevel = ''): EngageAiConfig {
  const totalCount = 8
  return {
    topic: '',
    detail: '',
    subject,
    gradeLevel,
    totalCount,
    mixPreset: 'mixed_live',
    typeMix: engageMixForPreset('mixed_live', totalCount),
    pace: 'standard',
    replaceMode: 'replace',
  }
}

export function validateEngageAiConfig(
  config: EngageAiConfig
): { ok: true } | { ok: false; error: string } {
  if (!config.topic.trim()) return { ok: false, error: 'Add a topic for the live quiz first.' }
  if (!config.subject.trim()) return { ok: false, error: 'Pick a subject so the questions fit your class.' }
  if (!config.gradeLevel.trim()) return { ok: false, error: 'Pick a level so wording fits your students.' }
  const total = engageMixTotal(config.typeMix)
  if (total < MIN_ENGAGE_QUESTIONS) {
    return { ok: false, error: `Add at least ${MIN_ENGAGE_QUESTIONS} questions across your mix.` }
  }
  if (total > MAX_ENGAGE_QUESTIONS) {
    return { ok: false, error: `Keep the total at ${MAX_ENGAGE_QUESTIONS} questions or fewer.` }
  }
  if (config.mixPreset !== 'custom' && total !== config.totalCount) {
    return { ok: false, error: 'Question mix does not match your total. Pick a preset again or switch to custom.' }
  }
  return { ok: true }
}

function mixSummary(mix: EngageTypeMix): string[] {
  const parts: string[] = []
  if (mix.mcq) parts.push(`${mix.mcq} multiple choice`)
  if (mix.true_false) parts.push(`${mix.true_false} true/false`)
  if (mix.multi_select) parts.push(`${mix.multi_select} multi-select`)
  if (mix.short_answer) parts.push(`${mix.short_answer} short answer`)
  if (mix.poll) parts.push(`${mix.poll} poll`)
  return parts
}

export function buildEngageAiPreview(config: EngageAiConfig): {
  headline: string
  lines: string[]
  estimatedSeconds: number
} {
  const total = engageMixTotal(config.typeMix)
  const pace = ENGAGE_PACE_OPTIONS.find(p => p.id === config.pace) ?? ENGAGE_PACE_OPTIONS[1]
  const estimatedSeconds = total * pace.seconds
  const lines = [
    `Topic: ${config.topic.trim()}`,
    mixSummary(config.typeMix).length
      ? `Mix: ${mixSummary(config.typeMix).join(', ')}`
      : 'Mix: not set yet',
    `Pace: ${pace.label} (${pace.seconds}s per question)`,
    `Style: Live classroom quiz, Ghanaian examples`,
    `Est. run time: about ${Math.round(estimatedSeconds / 60)} min`,
  ]
  if (config.detail.trim()) {
    lines.splice(1, 0, `Notes: ${config.detail.trim().slice(0, 120)}${config.detail.length > 120 ? '...' : ''}`)
  }
  return {
    headline: `${total} question${total === 1 ? '' : 's'} for ${config.gradeLevel || 'your level'} · ${config.subject || 'your subject'}`,
    lines,
    estimatedSeconds,
  }
}

export function loadingMessageForEngageConfig(config: EngageAiConfig): string {
  const total = engageMixTotal(config.typeMix)
  return `Drafting ${total} live quiz question${total === 1 ? '' : 's'} on ${config.topic.trim()} for ${config.gradeLevel} ${config.subject}...`
}

function optionsForType(type: QuestionType) {
  if (type === 'true_false') return [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }]
  return [
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ]
}

export function normalizeGeneratedEngageQuestions(
  raw: QuizQuestion[],
  pace: EngagePace
): QuizQuestion[] {
  const seconds = ENGAGE_PACE_OPTIONS.find(p => p.id === pace)?.seconds ?? 20
  const allowed: QuestionType[] = ['mcq', 'true_false', 'multi_select', 'short_answer', 'poll']

  return raw.map(q => {
    const type = allowed.includes(q.type) ? q.type : 'mcq'
    return {
      id: q.id || crypto.randomUUID(),
      type,
      text: q.text ?? '',
      options: q.options?.length ? q.options : optionsForType(type),
      correct: q.correct ?? 'A',
      correct_multiple: Array.isArray(q.correct_multiple) ? q.correct_multiple : [],
      correct_text: q.correct_text ?? '',
      time_seconds: q.time_seconds ?? seconds,
      points: q.points ?? 100,
      image_url: q.image_url,
    }
  })
}

export function configToEngageApiContext(config: EngageAiConfig): Record<string, unknown> {
  const pace = ENGAGE_PACE_OPTIONS.find(p => p.id === config.pace) ?? ENGAGE_PACE_OPTIONS[1]
  return {
    subject: config.subject,
    gradeLevel: config.gradeLevel,
    count: engageMixTotal(config.typeMix),
    detail: config.detail.trim() || undefined,
    typeMix: config.typeMix,
    pace: config.pace,
    timeSeconds: pace.seconds,
  }
}
