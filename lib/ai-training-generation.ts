import type { PathStep } from './types'
import type { TrainStepType } from './train-paths'
import { defaultStepContent } from './train-paths'

export type TrainingMixPreset = 'compliance' | 'onboarding' | 'skills' | 'custom'
export type TrainingDepth = 'overview' | 'standard' | 'deep'
export type ReplaceMode = 'replace' | 'append'

export interface TrainingTypeMix {
  video: number
  reading: number
  quiz: number
  sign_off: number
  assessment: number
}

export interface TrainingAiConfig {
  topic: string
  detail: string
  category: string
  totalCount: number
  mixPreset: TrainingMixPreset
  typeMix: TrainingTypeMix
  depth: TrainingDepth
  replaceMode: ReplaceMode
}

export const TRAINING_CATEGORIES = ['Compliance', 'Onboarding', 'Skills', 'Leadership']

export const TRAINING_MIX_PRESETS: { id: TrainingMixPreset; label: string; desc: string }[] = [
  { id: 'compliance', label: 'Compliance path', desc: 'Reading, quiz checks, and a sign-off' },
  { id: 'onboarding', label: 'Onboarding path', desc: 'Video, reading, quiz, and sign-off' },
  { id: 'skills', label: 'Skills path', desc: 'Practice-heavy with quiz and assessment' },
  { id: 'custom', label: 'Custom mix', desc: 'Set the count for each step type' },
]

export const TRAINING_DEPTH_OPTIONS: { id: TrainingDepth; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'standard', label: 'Standard' },
  { id: 'deep', label: 'Deep dive' },
]

export const DEFAULT_STEP_DURATION: Record<TrainStepType, number> = {
  video: 12,
  reading: 15,
  quiz: 10,
  sign_off: 5,
  assessment: 20,
}

export const MIN_TRAINING_STEPS = 3
export const MAX_TRAINING_STEPS = 12

export function trainingMixTotal(mix: TrainingTypeMix): number {
  return mix.video + mix.reading + mix.quiz + mix.sign_off + mix.assessment
}

export function trainingMixForPreset(preset: TrainingMixPreset, total: number): TrainingTypeMix {
  const n = Math.max(MIN_TRAINING_STEPS, Math.min(MAX_TRAINING_STEPS, total))

  if (preset === 'compliance') {
    const sign_off = 1
    const quiz = Math.max(1, Math.floor(n * 0.3))
    const reading = Math.max(1, n - sign_off - quiz)
    return { video: 0, reading, quiz, sign_off, assessment: 0 }
  }

  if (preset === 'onboarding') {
    const sign_off = 1
    const quiz = Math.max(1, Math.floor(n * 0.25))
    const video = Math.max(1, Math.floor(n * 0.25))
    const reading = Math.max(1, n - sign_off - quiz - video)
    return { video, reading, quiz, sign_off, assessment: 0 }
  }

  if (preset === 'skills') {
    const assessment = n >= 5 ? 1 : 0
    const quiz = Math.max(1, Math.floor(n * 0.3))
    const video = Math.max(1, Math.floor(n * 0.25))
    const reading = Math.max(1, n - assessment - quiz - video)
    return { video, reading, quiz, sign_off: 0, assessment }
  }

  return { video: 0, reading: n, quiz: 0, sign_off: 0, assessment: 0 }
}

export function defaultTrainingAiConfig(category = 'Compliance'): TrainingAiConfig {
  const totalCount = 5
  const mixPreset: TrainingMixPreset =
    category === 'Onboarding' ? 'onboarding' : category === 'Skills' || category === 'Leadership' ? 'skills' : 'compliance'
  return {
    topic: '',
    detail: '',
    category,
    totalCount,
    mixPreset,
    typeMix: trainingMixForPreset(mixPreset, totalCount),
    depth: 'standard',
    replaceMode: 'replace',
  }
}

export function validateTrainingAiConfig(
  config: TrainingAiConfig
): { ok: true } | { ok: false; error: string } {
  if (!config.topic.trim()) return { ok: false, error: 'Add a training brief or topic first.' }
  if (!config.category.trim()) return { ok: false, error: 'Pick a category for this path.' }
  const total = trainingMixTotal(config.typeMix)
  if (total < MIN_TRAINING_STEPS) {
    return { ok: false, error: `Add at least ${MIN_TRAINING_STEPS} steps across your mix.` }
  }
  if (total > MAX_TRAINING_STEPS) {
    return { ok: false, error: `Keep the total at ${MAX_TRAINING_STEPS} steps or fewer.` }
  }
  if (config.mixPreset !== 'custom' && total !== config.totalCount) {
    return { ok: false, error: 'Step mix does not match your total. Pick a preset again or switch to custom.' }
  }
  return { ok: true }
}

function mixSummary(mix: TrainingTypeMix): string[] {
  const parts: string[] = []
  if (mix.video) parts.push(`${mix.video} video`)
  if (mix.reading) parts.push(`${mix.reading} reading`)
  if (mix.quiz) parts.push(`${mix.quiz} quiz`)
  if (mix.sign_off) parts.push(`${mix.sign_off} sign-off`)
  if (mix.assessment) parts.push(`${mix.assessment} assessment`)
  return parts
}

export function buildTrainingAiPreview(config: TrainingAiConfig): {
  headline: string
  lines: string[]
  estimatedMinutes: number
} {
  const total = trainingMixTotal(config.typeMix)
  const estimatedMinutes =
    config.typeMix.video * DEFAULT_STEP_DURATION.video +
    config.typeMix.reading * DEFAULT_STEP_DURATION.reading +
    config.typeMix.quiz * DEFAULT_STEP_DURATION.quiz +
    config.typeMix.sign_off * DEFAULT_STEP_DURATION.sign_off +
    config.typeMix.assessment * DEFAULT_STEP_DURATION.assessment

  const depthLabel = TRAINING_DEPTH_OPTIONS.find(d => d.id === config.depth)?.label ?? 'Standard'
  const lines = [
    `Brief: ${config.topic.trim()}`,
    mixSummary(config.typeMix).length
      ? `Mix: ${mixSummary(config.typeMix).join(', ')}`
      : 'Mix: not set yet',
    `Depth: ${depthLabel}`,
    `Style: Ghanaian workplace training`,
    `Est. time: about ${estimatedMinutes} minutes`,
  ]
  if (config.detail.trim()) {
    lines.splice(1, 0, `Notes: ${config.detail.trim().slice(0, 120)}${config.detail.length > 120 ? '...' : ''}`)
  }
  return {
    headline: `${total} step${total === 1 ? '' : 's'} · ${config.category || 'Training'}`,
    lines,
    estimatedMinutes,
  }
}

export function loadingMessageForTrainingConfig(config: TrainingAiConfig): string {
  const total = trainingMixTotal(config.typeMix)
  return `Drafting ${total} training step${total === 1 ? '' : 's'} for ${config.category}: ${config.topic.trim()}...`
}

export function normalizeGeneratedTrainingSteps(raw: PathStep[]): PathStep[] {
  const allowed: TrainStepType[] = ['video', 'reading', 'quiz', 'sign_off', 'assessment']
  return raw.map((step, index) => {
    const type = allowed.includes(step.type as TrainStepType)
      ? (step.type as TrainStepType)
      : 'reading'
    return {
      id: step.id || `s-${Date.now()}-${index}`,
      title: (step.title ?? '').trim() || `Step ${index + 1}`,
      type,
      duration_minutes: step.duration_minutes ?? DEFAULT_STEP_DURATION[type],
      is_mandatory: step.is_mandatory ?? true,
      content: step.content && Object.keys(step.content).length > 0
        ? step.content
        : defaultStepContent(type),
    }
  })
}

export function configToTrainingApiContext(config: TrainingAiConfig): Record<string, unknown> {
  return {
    category: config.category,
    count: trainingMixTotal(config.typeMix),
    detail: config.detail.trim() || undefined,
    typeMix: config.typeMix,
    depth: config.depth,
    durationPerType: DEFAULT_STEP_DURATION,
  }
}
