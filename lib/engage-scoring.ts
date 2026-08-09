import type { QuizQuestion, QuestionType } from './types'

// Engage scoring.
//
// Speed is a weighted component, never the whole game. Pure speed scoring
// rewards the fastest handset and the strongest English reader rather than
// the best learner, which in a classroom on shared devices and second
// language reading is an equity problem, not a game mechanic. Teachers set
// the weight; the defaults follow the age band.

export interface ScoringModel {
  /** 0 = accuracy only. 0.5 = a slow correct answer is worth half a fast one. */
  speedWeight: number
  /** Consecutive correct answers compound, rewarding consistency. */
  streakEnabled: boolean
  /** First correct answer takes a bonus. Quiz-show feel, best for older bands. */
  fastestFinger: boolean
  /** Later questions count for more, so nobody is mathematically out early. */
  comebackWeighting: boolean
}

export const SCORING_PRESETS: Record<string, { label: string; hint: string; model: ScoringModel }> = {
  gentle: {
    label: 'Gentle',
    hint: 'Accuracy only. Nobody is punished for reading slowly.',
    model: { speedWeight: 0, streakEnabled: true, fastestFinger: false, comebackWeighting: true },
  },
  balanced: {
    label: 'Balanced',
    hint: 'Speed matters a little. A slow correct answer still scores well.',
    model: { speedWeight: 0.35, streakEnabled: true, fastestFinger: false, comebackWeighting: true },
  },
  competitive: {
    label: 'Competitive',
    hint: 'Speed matters. Quiz-show pace for confident classes.',
    model: { speedWeight: 0.5, streakEnabled: true, fastestFinger: true, comebackWeighting: false },
  },
}

/**
 * Sensible default by who is playing. Younger bands start on accuracy only:
 * for Primary the goal is participation, not reaction time.
 */
export function defaultScoringPreset(levelType?: string | null): keyof typeof SCORING_PRESETS {
  const t = (levelType ?? '').toLowerCase()
  if (t.includes('primary') || t.includes('basic')) return 'gentle'
  if (t.includes('corporate') || t.includes('professional') || t.includes('university') || t.includes('college')) return 'balanced'
  if (t.includes('shs') || t.includes('senior')) return 'competitive'
  return 'balanced'
}

export function scoringModelFromSettings(settings: unknown): ScoringModel {
  const s = (settings ?? {}) as { scoring?: Partial<ScoringModel>; scoring_preset?: string }
  if (s.scoring) {
    return {
      speedWeight: clamp(Number(s.scoring.speedWeight ?? 0.35), 0, 1),
      streakEnabled: s.scoring.streakEnabled !== false,
      fastestFinger: s.scoring.fastestFinger === true,
      comebackWeighting: s.scoring.comebackWeighting !== false,
    }
  }
  const preset = SCORING_PRESETS[s.scoring_preset ?? 'balanced'] ?? SCORING_PRESETS.balanced
  return preset.model
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Streak multiplier. Capped so one lucky run cannot decide the whole game. */
export function streakMultiplier(streak: number): number {
  if (streak >= 5) return 2
  if (streak >= 3) return 1.5
  return 1
}

export interface ScoreInput {
  correct: boolean
  basePoints: number
  /** Milliseconds from the server's question_started_at to the answer. */
  elapsedMs: number
  limitMs: number
  /** Streak BEFORE this answer. */
  streak: number
  model: ScoringModel
  /** True when this is the first correct answer in the room. */
  isFirstCorrect?: boolean
  /** 0-based question position, for comeback weighting. */
  questionIndex?: number
  totalQuestions?: number
  /** 0 to 1 for partly-right answers. Defaults to fully right. */
  partial?: number
}

export interface ScoreResult {
  points: number
  speedBonus: number
  streakBonus: number
  firstBonus: number
  nextStreak: number
}

export function computeScore(input: ScoreInput): ScoreResult {
  // Partly-right answers scale the whole award, so a four-of-five ordering
  // still pays rather than scoring nothing.
  const partial = clamp(input.partial ?? (input.correct ? 1 : 0), 0, 1)

  if (partial <= 0) {
    // Nothing earned breaks the streak, but never goes negative.
    return { points: 0, speedBonus: 0, streakBonus: 0, firstBonus: 0, nextStreak: 0 }
  }

  // Only a fully correct answer keeps a streak alive. Partial credit pays,
  // but it does not count as a clean run.
  const nextStreak = input.correct ? input.streak + 1 : 0

  const base = Math.max(0, (input.basePoints || 100) * partial)
  const limit = Math.max(1, input.limitMs)
  // Clamp so a late-arriving write or a clock skew cannot mint points.
  const elapsed = clamp(input.elapsedMs, 0, limit)
  const fraction = elapsed / limit

  // Speed component. At speedWeight 0 every correct answer is worth full
  // marks; at 0.5 the slowest correct answer still earns half.
  const speedMultiplier = 1 - fraction * input.model.speedWeight
  const afterSpeed = base * speedMultiplier
  const speedBonus = Math.round(afterSpeed - base)

  const multiplier = input.model.streakEnabled ? streakMultiplier(input.streak) : 1
  const afterStreak = afterSpeed * multiplier
  const streakBonus = Math.round(afterStreak - afterSpeed)

  const firstBonus =
    input.model.fastestFinger && input.isFirstCorrect ? Math.round(base * 0.25) : 0

  // Later questions weigh more, so a slow start is recoverable and the room
  // stays in the game to the last question.
  let total = afterStreak + firstBonus
  if (
    input.model.comebackWeighting &&
    typeof input.questionIndex === 'number' &&
    typeof input.totalQuestions === 'number' &&
    input.totalQuestions > 1
  ) {
    const progress = input.questionIndex / (input.totalQuestions - 1)
    total *= 1 + progress * 0.5
  }

  return {
    points: Math.max(0, Math.round(total)),
    speedBonus,
    streakBonus,
    firstBonus,
    nextStreak,
  }
}

// ---------------------------------------------------------------------
// Answer checking. Previously only single-label questions were scored,
// so multi_select, short_answer and poll were generatable but unplayable.
// ---------------------------------------------------------------------

function normaliseText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
}

export interface AnswerCheck {
  correct: boolean
  /** True when the question has no right answer, e.g. a poll. */
  unscored: boolean
  /**
   * 0 to 1, for questions that can be partly right. Ordering pays per item
   * in the correct position, and numeric pays for being close. All-or-nothing
   * on a five-step sequence is punishing enough that players stop trying.
   */
  partial?: number
}

export function checkAnswer(question: QuizQuestion, answer: unknown): AnswerCheck {
  const type: QuestionType = question.type

  if (type === 'poll') {
    // A poll gathers opinion. Everyone who takes part is credited, and it
    // never separates the leaderboard.
    return { correct: true, unscored: true }
  }

  if (type === 'multi_select') {
    const picked = Array.isArray(answer) ? answer.map(String) : String(answer ?? '').split(',')
    const expected = question.correct_multiple ?? []
    const a = new Set(picked.map(s => s.trim()).filter(Boolean))
    const b = new Set(expected.map(s => s.trim()).filter(Boolean))
    if (a.size !== b.size || a.size === 0) return { correct: false, unscored: false }
    for (const label of b) if (!a.has(label)) return { correct: false, unscored: false }
    return { correct: true, unscored: false }
  }

  if (type === 'short_answer') {
    const given = normaliseText(String(answer ?? ''))
    if (!given) return { correct: false, unscored: false }
    // The canonical answer, plus any option text kept as an accepted variant.
    const accepted = [question.correct_text ?? '', ...(question.options ?? []).map(o => o.text)]
      .map(normaliseText)
      .filter(Boolean)
    return { correct: accepted.includes(given), unscored: false }
  }

  if (type === 'numeric') {
    const given = Number(String(answer ?? '').replace(/[^\d.\-]/g, ''))
    const target = Number(question.correct_number)
    if (!Number.isFinite(given) || !Number.isFinite(target)) {
      return { correct: false, unscored: false }
    }
    // Default tolerance is 5% of the target, so estimation questions work
    // without the author having to think about it.
    const tolerance = Math.abs(
      Number.isFinite(Number(question.tolerance)) && Number(question.tolerance) > 0
        ? Number(question.tolerance)
        : Math.abs(target) * 0.05
    )
    const distance = Math.abs(given - target)
    if (tolerance === 0) {
      return { correct: distance === 0, unscored: false, partial: distance === 0 ? 1 : 0 }
    }
    if (distance > tolerance) return { correct: false, unscored: false, partial: 0 }
    // Dead on pays full; the edge of the band still pays half.
    const closeness = 1 - distance / tolerance
    return { correct: true, unscored: false, partial: 0.5 + closeness * 0.5 }
  }

  if (type === 'ordering') {
    const given = Array.isArray(answer)
      ? answer.map(String)
      : String(answer ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const expected = question.correct_order ?? []
    if (expected.length === 0 || given.length === 0) {
      return { correct: false, unscored: false, partial: 0 }
    }
    let inPlace = 0
    expected.forEach((label, i) => {
      if (given[i] === label) inPlace++
    })
    // Any shuffle leaves one item in place on average, so raw positional
    // credit would pay for guessing. Subtracting that baseline means a
    // random order scores nothing and only real ordering earns.
    const n = expected.length
    const partial =
      n <= 1 ? (inPlace === n ? 1 : 0) : Math.max(0, (inPlace - 1) / (n - 1))
    return { correct: inPlace === n, unscored: false, partial }
  }

  // mcq and true_false
  return { correct: String(answer ?? '') === question.correct, unscored: false }
}
