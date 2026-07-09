export type CourseModuleType = 'video' | 'reading' | 'quiz' | 'assignment' | 'flashcards'
export type CourseMixPreset = 'balanced' | 'reading_heavy' | 'practice_heavy' | 'custom'
export type CourseDepth = 'overview' | 'standard' | 'deep'
export type ReplaceMode = 'replace' | 'append'

export interface CourseTypeMix {
  video: number
  reading: number
  quiz: number
  assignment: number
  flashcards: number
}

export interface CourseAiConfig {
  topic: string
  detail: string
  subject: string
  gradeLevel: string
  totalCount: number
  mixPreset: CourseMixPreset
  typeMix: CourseTypeMix
  depth: CourseDepth
  replaceMode: ReplaceMode
}

export interface GeneratedCourseModule {
  id: string
  title: string
  type: CourseModuleType
  duration_minutes: number
  is_mandatory: boolean
  content: {
    video_url?: string
    body?: string
    instructions?: string
    questions?: { question: string; options: string[]; correct: number }[]
    cards?: { front: string; back: string }[]
  }
}

export const COURSE_SUBJECTS = [
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
  'Business',
  'General',
]

export const COURSE_MIX_PRESETS: { id: CourseMixPreset; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced course', desc: 'Reading, video, practice quiz, and a short task' },
  { id: 'reading_heavy', label: 'Reading-led', desc: 'Mostly readings with a check quiz at the end' },
  { id: 'practice_heavy', label: 'Practice-led', desc: 'Quizzes and flashcards with supporting reading' },
  { id: 'custom', label: 'Custom mix', desc: 'Set the count for each module type' },
]

export const COURSE_DEPTH_OPTIONS: { id: CourseDepth; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'standard', label: 'Standard' },
  { id: 'deep', label: 'Deep dive' },
]

export const DEFAULT_MODULE_DURATION: Record<CourseModuleType, number> = {
  video: 12,
  reading: 15,
  quiz: 10,
  assignment: 20,
  flashcards: 8,
}

export const MIN_MODULES = 2
export const MAX_MODULES = 12

export function courseMixTotal(mix: CourseTypeMix): number {
  return mix.video + mix.reading + mix.quiz + mix.assignment + mix.flashcards
}

export function courseMixForPreset(preset: CourseMixPreset, total: number): CourseTypeMix {
  const n = Math.max(MIN_MODULES, Math.min(MAX_MODULES, total))

  if (preset === 'reading_heavy') {
    const quiz = n >= 3 ? 1 : 0
    const video = n >= 4 ? 1 : 0
    const reading = Math.max(1, n - quiz - video)
    return { video, reading, quiz, assignment: 0, flashcards: 0 }
  }

  if (preset === 'practice_heavy') {
    const quiz = Math.max(1, Math.floor(n * 0.4))
    const flashcards = n >= 4 ? Math.max(1, Math.floor(n * 0.25)) : 0
    const reading = Math.max(1, Math.floor(n * 0.25))
    const remaining = Math.max(0, n - quiz - flashcards - reading)
    const video = remaining > 0 ? 1 : 0
    const assignment = Math.max(0, remaining - video)
    return { video, reading, quiz, assignment, flashcards }
  }

  if (preset === 'balanced') {
    if (n === 2) return { video: 0, reading: 1, quiz: 1, assignment: 0, flashcards: 0 }
    if (n === 3) return { video: 1, reading: 1, quiz: 1, assignment: 0, flashcards: 0 }
    const quiz = Math.max(1, Math.floor(n * 0.25))
    const reading = Math.max(1, Math.floor(n * 0.35))
    const video = Math.max(1, Math.floor(n * 0.2))
    let used = quiz + reading + video
    let assignment = 0
    let flashcards = 0
    if (used < n) {
      assignment = 1
      used += 1
    }
    if (used < n) {
      flashcards = n - used
    }
    // If we overshot somehow, trim reading
    const total = video + reading + quiz + assignment + flashcards
    if (total > n) {
      return {
        video,
        reading: Math.max(1, reading - (total - n)),
        quiz,
        assignment,
        flashcards,
      }
    }
    if (total < n) {
      return { video, reading: reading + (n - total), quiz, assignment, flashcards }
    }
    return { video, reading, quiz, assignment, flashcards }
  }

  return { video: 0, reading: n, quiz: 0, assignment: 0, flashcards: 0 }
}

export function defaultCourseAiConfig(subject = '', gradeLevel = ''): CourseAiConfig {
  const totalCount = 4
  return {
    topic: '',
    detail: '',
    subject,
    gradeLevel,
    totalCount,
    mixPreset: 'balanced',
    typeMix: courseMixForPreset('balanced', totalCount),
    depth: 'standard',
    replaceMode: 'replace',
  }
}

export function validateCourseAiConfig(
  config: CourseAiConfig
): { ok: true } | { ok: false; error: string } {
  if (!config.topic.trim()) {
    return { ok: false, error: 'Add a topic or learning outcome first.' }
  }
  if (!config.subject.trim()) {
    return { ok: false, error: 'Pick a subject so the modules match your course.' }
  }
  if (!config.gradeLevel.trim()) {
    return { ok: false, error: 'Pick a level so wording fits your learners.' }
  }
  const total = courseMixTotal(config.typeMix)
  if (total < MIN_MODULES) {
    return { ok: false, error: `Add at least ${MIN_MODULES} modules across your mix.` }
  }
  if (total > MAX_MODULES) {
    return { ok: false, error: `Keep the total at ${MAX_MODULES} modules or fewer.` }
  }
  if (config.mixPreset !== 'custom' && total !== config.totalCount) {
    return { ok: false, error: 'Module mix does not match your total. Pick a preset again or switch to custom.' }
  }
  return { ok: true }
}

function mixSummary(mix: CourseTypeMix): string[] {
  const parts: string[] = []
  if (mix.video) parts.push(`${mix.video} video`)
  if (mix.reading) parts.push(`${mix.reading} reading`)
  if (mix.quiz) parts.push(`${mix.quiz} quiz`)
  if (mix.assignment) parts.push(`${mix.assignment} assignment`)
  if (mix.flashcards) parts.push(`${mix.flashcards} flashcards`)
  return parts
}

export function buildCourseAiPreview(config: CourseAiConfig): {
  headline: string
  lines: string[]
  estimatedMinutes: number
} {
  const total = courseMixTotal(config.typeMix)
  const mixParts = mixSummary(config.typeMix)
  const estimatedMinutes =
    config.typeMix.video * DEFAULT_MODULE_DURATION.video +
    config.typeMix.reading * DEFAULT_MODULE_DURATION.reading +
    config.typeMix.quiz * DEFAULT_MODULE_DURATION.quiz +
    config.typeMix.assignment * DEFAULT_MODULE_DURATION.assignment +
    config.typeMix.flashcards * DEFAULT_MODULE_DURATION.flashcards

  const depthLabel =
    COURSE_DEPTH_OPTIONS.find(d => d.id === config.depth)?.label ?? 'Standard'

  const lines = [
    `Topic: ${config.topic.trim()}`,
    mixParts.length ? `Mix: ${mixParts.join(', ')}` : 'Mix: not set yet',
    `Depth: ${depthLabel}`,
    `Style: Ghanaian classroom, clear learning outcomes`,
    `Est. time: about ${estimatedMinutes} minutes`,
  ]

  if (config.detail.trim()) {
    lines.splice(
      1,
      0,
      `Syllabus notes: ${config.detail.trim().slice(0, 120)}${config.detail.length > 120 ? '...' : ''}`
    )
  }

  return {
    headline: `${total} module${total === 1 ? '' : 's'} for ${config.gradeLevel || 'your level'} · ${config.subject || 'your subject'}`,
    lines,
    estimatedMinutes,
  }
}

export function loadingMessageForCourseConfig(config: CourseAiConfig): string {
  const total = courseMixTotal(config.typeMix)
  const topic = config.topic.trim()
  return `Drafting ${total} module${total === 1 ? '' : 's'} on ${topic} for ${config.gradeLevel} ${config.subject}...`
}

function emptyQuizQuestion() {
  return { question: '', options: ['', '', '', ''], correct: 0 }
}

export function normalizeGeneratedModules(
  raw: GeneratedCourseModule[],
  mix: CourseTypeMix
): GeneratedCourseModule[] {
  const allowed: CourseModuleType[] = ['video', 'reading', 'quiz', 'assignment', 'flashcards']
  return raw.map((m, index) => {
    const type = allowed.includes(m.type) ? m.type : 'reading'
    const content = m.content ?? {}
    const base: GeneratedCourseModule = {
      id: m.id || `m-${Date.now()}-${index}`,
      title: (m.title ?? '').trim() || `Module ${index + 1}`,
      type,
      duration_minutes: m.duration_minutes ?? DEFAULT_MODULE_DURATION[type],
      is_mandatory: m.is_mandatory ?? true,
      content: {},
    }

    if (type === 'video') {
      return {
        ...base,
        content: {
          video_url: content.video_url ?? '',
          body: content.body ?? '',
        },
      }
    }
    if (type === 'reading') {
      return {
        ...base,
        content: {
          body: content.body ?? '',
        },
      }
    }
    if (type === 'assignment') {
      return {
        ...base,
        content: {
          instructions: content.instructions ?? content.body ?? '',
        },
      }
    }
    if (type === 'quiz') {
      const questions = Array.isArray(content.questions) && content.questions.length > 0
        ? content.questions.map(q => ({
            question: q.question ?? '',
            options: Array.isArray(q.options) && q.options.length >= 2
              ? q.options.slice(0, 4).concat(Array(Math.max(0, 4 - q.options.length)).fill('')).slice(0, 4)
              : emptyQuizQuestion().options,
            correct: typeof q.correct === 'number' ? q.correct : 0,
          }))
        : [emptyQuizQuestion(), emptyQuizQuestion(), emptyQuizQuestion()]
      return { ...base, content: { questions } }
    }
    // flashcards
    const cards = Array.isArray(content.cards) && content.cards.length > 0
      ? content.cards.map(c => ({ front: c.front ?? '', back: c.back ?? '' }))
      : [
          { front: '', back: '' },
          { front: '', back: '' },
          { front: '', back: '' },
        ]
    return { ...base, content: { cards } }
  })
}

export function configToCourseApiContext(config: CourseAiConfig): Record<string, unknown> {
  return {
    subject: config.subject,
    gradeLevel: config.gradeLevel,
    count: courseMixTotal(config.typeMix),
    detail: config.detail.trim() || undefined,
    typeMix: config.typeMix,
    depth: config.depth,
    durationPerType: DEFAULT_MODULE_DURATION,
  }
}
