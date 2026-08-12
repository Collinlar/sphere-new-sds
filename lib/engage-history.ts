import { supabase } from './supabase'
import { checkAnswer, describeCorrectAnswer, isOptionQuestion } from './engage-scoring'
import type { Quiz, QuizQuestion } from './types'

/**
 * Reading finished games back out.
 *
 * Every live session already writes what happened: an ended row in
 * engage_sessions, final scores on session_participants, and one
 * session_responses row per answer carrying the answer, correctness and
 * points. Nothing here adds storage. It only surfaces what was always
 * being kept, because the most useful thing Engage produces, which class
 * missed which question and what they said instead, was disappearing the
 * moment the host clicked Next.
 */

export interface SessionSummary {
  id: string
  quizId: string
  quizTitle: string
  mode: string
  modeLabel: string
  playedAt: string
  players: number
  avgScore: number
  questions: number
}

export interface QuestionBreakdown {
  index: number
  text: string
  type: QuizQuestion['type']
  correctLabel: string
  answered: number
  correct: number
  pctCorrect: number
  /** Most common answers, wrong ones first, for reteaching. */
  topAnswers: { answer: string; display: string; count: number; correct: boolean }[]
  /** Set when a distractor beat the right answer, worth saying out loud. */
  misconception: string | null
}

export interface SessionReport {
  session: SessionSummary
  players: { name: string; score: number; teamName: string | null }[]
  teams: { name: string; score: number; color: string }[]
  questions: QuestionBreakdown[]
  /** Questions the class struggled with most, hardest first. */
  weakest: QuestionBreakdown[]
}

const MODE_LABELS: Record<string, string> = {
  competitive: 'Competitive',
  team: 'Team',
  co_op: 'Co-op',
  one_screen: 'One screen',
}

function modeOf(settings: unknown): { mode: string; label: string } {
  const mode = (settings as { game_mode?: string } | null)?.game_mode ?? 'competitive'
  return { mode, label: MODE_LABELS[mode] ?? 'Competitive' }
}

/**
 * Finished sessions for a set of quizzes, newest first. Scoped by quiz
 * rather than by host so an institution sees the whole department's games,
 * matching how the library itself is scoped.
 */
export async function fetchSessionHistory(
  quizIds: string[],
  limit = 40,
): Promise<SessionSummary[]> {
  if (quizIds.length === 0) return []

  const { data: sessions } = await supabase
    .from('engage_sessions')
    .select('id, quiz_id, settings, ended_at, created_at')
    .in('quiz_id', quizIds)
    .eq('status', 'ended')
    .order('ended_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  const rows = sessions ?? []
  if (rows.length === 0) return []

  const sessionIds = rows.map(r => r.id as string)

  const [{ data: participants }, { data: quizzes }] = await Promise.all([
    supabase.from('session_participants').select('session_id, score').in('session_id', sessionIds),
    supabase.from('quizzes').select('id, title, questions').in('id', quizIds),
  ])

  const byQuiz = new Map((quizzes ?? []).map(q => [q.id as string, q as Partial<Quiz>]))

  const scores = new Map<string, number[]>()
  for (const p of participants ?? []) {
    const key = p.session_id as string
    const list = scores.get(key) ?? []
    list.push(Number(p.score ?? 0))
    scores.set(key, list)
  }

  return rows.map(r => {
    const list = scores.get(r.id as string) ?? []
    const quiz = byQuiz.get(r.quiz_id as string)
    const { mode, label } = modeOf(r.settings)
    return {
      id: r.id as string,
      quizId: r.quiz_id as string,
      quizTitle: quiz?.title ?? 'Deleted quiz',
      mode,
      modeLabel: label,
      playedAt: (r.ended_at as string) ?? (r.created_at as string),
      players: list.length,
      avgScore: list.length > 0 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0,
      questions: quiz?.questions?.length ?? 0,
    }
  })
}

/** Everything one finished game produced, question by question. */
export async function fetchSessionReport(sessionId: string): Promise<SessionReport | null> {
  const { data: session } = await supabase
    .from('engage_sessions')
    .select('id, quiz_id, settings, ended_at, created_at, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return null

  const [{ data: quiz }, { data: participants }, { data: responses }, { data: teams }] = await Promise.all([
    supabase.from('quizzes').select('id, title, questions').eq('id', session.quiz_id).maybeSingle(),
    supabase.from('session_participants').select('display_name, score, team_id').eq('session_id', sessionId).order('score', { ascending: false }),
    supabase.from('session_responses').select('question_index, answer, is_correct').eq('session_id', sessionId),
    supabase.from('engage_teams').select('id, name, score, color').eq('session_id', sessionId).order('score', { ascending: false }),
  ])

  const questions: QuizQuestion[] = (quiz?.questions as QuizQuestion[]) ?? []
  const { mode, label } = modeOf(session.settings)

  const teamNames = new Map((teams ?? []).map(t => [t.id as string, t.name as string]))
  const scores = (participants ?? []).map(p => Number(p.score ?? 0))

  const summary: SessionSummary = {
    id: session.id as string,
    quizId: session.quiz_id as string,
    quizTitle: quiz?.title ?? 'Deleted quiz',
    mode,
    modeLabel: label,
    playedAt: (session.ended_at as string) ?? (session.created_at as string),
    players: scores.length,
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    questions: questions.length,
  }

  const breakdowns: QuestionBreakdown[] = questions.map((q, index) => {
    const rows = (responses ?? []).filter(r => Number(r.question_index) === index)
    const answered = rows.length

    const counts = new Map<string, { count: number; correct: boolean }>()
    let correct = 0
    for (const r of rows) {
      if (r.is_correct) correct++
      const answer = (r.answer as string | null) ?? ''
      if (!answer) continue
      const seen = counts.get(answer)
      if (seen) seen.count++
      // Re-checking rather than trusting the stored flag keeps this honest
      // when a host overrode the marking on a spoken answer.
      else counts.set(answer, { count: 1, correct: checkAnswer(q, answer).correct })
    }

    // An option answer is stored as its label, which means nothing in a
    // report weeks later. Show the text the students actually read.
    const displayOf = (answer: string) => {
      if (!isOptionQuestion(q.type)) return answer
      const opt = q.options?.find(o => o.label === answer)
      return opt ? `${answer}. ${opt.text}` : answer
    }

    const topAnswers = [...counts.entries()]
      .map(([answer, v]) => ({ answer, display: displayOf(answer), count: v.count, correct: v.correct }))
      .sort((a, b) => (a.correct === b.correct ? b.count - a.count : a.correct ? 1 : -1))
      .slice(0, 5)

    const pctCorrect = answered > 0 ? Math.round((correct / answered) * 100) : 0
    const topWrong = topAnswers.find(a => !a.correct)
    const misconception =
      topWrong && topWrong.count > correct && q.type !== 'poll'
        ? `More of the class answered "${topWrong.display}" than got it right.`
        : null

    return {
      index,
      text: q.text,
      type: q.type,
      correctLabel: describeCorrectAnswer(q),
      answered,
      correct,
      pctCorrect,
      topAnswers,
      misconception,
    }
  })

  // A poll cannot be got wrong, and an unanswered question says nothing
  // about the class, so neither belongs in the reteach list.
  const weakest = breakdowns
    .filter(b => b.answered > 0 && b.type !== 'poll')
    .sort((a, b) => a.pctCorrect - b.pctCorrect)
    .slice(0, 3)
    .filter(b => b.pctCorrect < 70)

  return {
    session: summary,
    players: (participants ?? []).map(p => ({
      name: p.display_name as string,
      score: Number(p.score ?? 0),
      teamName: p.team_id ? teamNames.get(p.team_id as string) ?? null : null,
    })),
    teams: (teams ?? []).map(t => ({
      name: t.name as string,
      score: Number(t.score ?? 0),
      color: (t.color as string) ?? '#2E2886',
    })),
    questions: breakdowns,
    weakest,
  }
}
