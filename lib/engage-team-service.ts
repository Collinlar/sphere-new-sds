import { supabase } from '@/lib/supabase'
import { TEAM_PRESETS, assignTeamIndex } from '@/lib/engage-teams'
import { checkAnswer, computeScore, type ScoringModel } from '@/lib/engage-scoring'
import type { QuizQuestion } from '@/lib/types'
import type { EngageTeam, TeamModeSettings } from '@/lib/engage-teams'

export async function ensureTeamsForSession(sessionId: string): Promise<EngageTeam[]> {
  const { data: existing } = await supabase.from('engage_teams').select('*').eq('session_id', sessionId)
  if (existing && existing.length > 0) return existing as EngageTeam[]

  const teams = TEAM_PRESETS.slice(0, 4).map(p => ({
    session_id: sessionId,
    name: p.name,
    letter: p.letter,
    color: p.color,
    score: 0,
  }))

  // The host page and every joining student call this, so several callers
  // can reach here at once having all seen an empty list. Upserting against
  // the (session_id, name) unique index means the racers collapse onto one
  // set of teams instead of each inserting their own.
  const { error } = await supabase
    .from('engage_teams')
    .upsert(teams, { onConflict: 'session_id,name', ignoreDuplicates: true })

  if (error) {
    // Never swallow this. An empty list here means no team assignment and a
    // blank play screen, which reads as a rendering bug rather than what it
    // is.
    console.error('[engage] could not create teams for session', sessionId, error.message)
  }

  // Always read back rather than trusting what this caller inserted, so the
  // winner's rows are what everyone works from.
  const { data: settled } = await supabase
    .from('engage_teams')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at')

  return (settled ?? []) as EngageTeam[]
}

export async function assignParticipantToTeam(
  sessionId: string,
  participantId: string,
): Promise<EngageTeam | null> {
  const teams = await ensureTeamsForSession(sessionId)
  if (teams.length === 0) return null

  const { data: members } = await supabase
    .from('session_participants')
    .select('id, team_id')
    .eq('session_id', sessionId)

  const counts: Record<string, number> = {}
  teams.forEach(t => { counts[t.id] = 0 })
  ;(members ?? []).forEach(m => {
    if (m.team_id && counts[m.team_id] != null) counts[m.team_id]++
  })

  const sorted = [...teams].sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0))
  const team = sorted[0]

  await supabase.from('session_participants').update({ team_id: team.id }).eq('id', participantId)
  return team
}

export async function getTeamMembers(sessionId: string, teamId: string) {
  const { data } = await supabase
    .from('session_participants')
    .select('id, display_name, team_vote, score')
    .eq('session_id', sessionId)
    .eq('team_id', teamId)
  return data ?? []
}

export function majorityAnswer(votes: (string | null | undefined)[]): string | null {
  const tally: Record<string, number> = {}
  votes.forEach(v => {
    if (v) tally[v] = (tally[v] ?? 0) + 1
  })
  let best: string | null = null
  let bestCount = 0
  Object.entries(tally).forEach(([k, c]) => {
    if (c > bestCount) { best = k; bestCount = c }
  })
  return best
}

export async function scoreTeamQuestion(
  sessionId: string,
  teamId: string,
  questionIndex: number,
  question: QuizQuestion,
  consensusBonus: boolean,
  memberCount: number,
  model: ScoringModel,
  totalQuestions?: number,
): Promise<{ points: number; consensus: boolean; streak: number }> {
  const members = await getTeamMembers(sessionId, teamId)
  const votes = members.map(m => m.team_vote)
  const teamAnswer = majorityAnswer(votes)

  // Same answer checking as solo play, so multi_select, short_answer and
  // poll behave identically in both modes.
  const check = checkAnswer(question, teamAnswer)
  const correct = check.correct && !check.unscored
  const allAgree = votes.length > 0 && votes.every(v => v === teamAnswer)

  const { data: team } = await supabase
    .from('engage_teams')
    .select('score, streak')
    .eq('id', teamId)
    .single()
  const currentStreak = Number(team?.streak ?? 0)

  // Speed is deliberately excluded for teams: rewarding a fast answer would
  // punish the discussion this mode exists to create. Everything else that
  // makes solo play feel like a game carries over.
  // A poll has no right answer, so taking part is the whole ask. Scoring it
  // as a wrong answer told a team "Not this time" and paid nothing for a
  // question they could not possibly get wrong.
  const result = check.unscored
    ? { points: Math.round((question.points || 100) / 2), nextStreak: currentStreak }
    : computeScore({
        correct,
        partial: check.partial,
        basePoints: question.points || 100,
        elapsedMs: 0,
        limitMs: 1,
        streak: currentStreak,
        model: { ...model, speedWeight: 0, fastestFinger: false },
        questionIndex,
        totalQuestions,
      })

  let points = result.points
  if (correct && !check.unscored && consensusBonus && allAgree && memberCount > 1) {
    points += Math.round((question.points || 100) * 0.5)
  }

  await supabase
    .from('engage_teams')
    .update({
      score: Number(team?.score ?? 0) + points,
      streak: result.nextStreak,
    })
    .eq('id', teamId)

  await supabase.from('session_responses').insert({
    session_id: sessionId,
    participant_id: members[0]?.id,
    question_index: questionIndex,
    answer: teamAnswer,
    is_correct: check.unscored ? null : correct,
    points_earned: points,
    team_id: teamId,
  })

  await supabase.from('session_participants').update({ team_vote: null }).eq('team_id', teamId)

  return { points, consensus: allAgree && correct, streak: result.nextStreak }
}

/**
 * Score one team's spoken answer in one-screen mode, where the class plays
 * off a single device and the host taps what each team said. Recording the
 * actual option, rather than just right or wrong, keeps the misconception
 * panel working when no student is holding a phone.
 */
export async function scoreSpokenAnswer(params: {
  sessionId: string
  teamId: string
  questionIndex: number
  question: QuizQuestion
  answerLabel: string
  model: ScoringModel
  totalQuestions?: number
  /**
   * The host's own verdict, for questions they cannot practically retype on
   * a projector: an ordering answer said out loud, for instance. When set,
   * it replaces automatic marking.
   */
  forceCorrect?: boolean
}): Promise<{ points: number; correct: boolean; streak: number }> {
  const { sessionId, teamId, questionIndex, question, answerLabel, model, totalQuestions, forceCorrect } = params

  const auto = checkAnswer(question, answerLabel)
  const check = forceCorrect === undefined
    ? auto
    : { correct: forceCorrect, unscored: auto.unscored, partial: forceCorrect ? 1 : 0 }
  const correct = check.correct && !check.unscored

  const { data: team } = await supabase
    .from('engage_teams')
    .select('score, streak')
    .eq('id', teamId)
    .single()

  // No timing exists here: the host taps after the class has spoken. Speed
  // is excluded rather than faked.
  const result = check.unscored
    ? { points: Math.round((question.points || 100) / 2), nextStreak: Number(team?.streak ?? 0) }
    : computeScore({
        correct,
        partial: check.partial,
        basePoints: question.points || 100,
        elapsedMs: 0,
        limitMs: 1,
        streak: Number(team?.streak ?? 0),
        model: { ...model, speedWeight: 0, fastestFinger: false },
        questionIndex,
        totalQuestions,
      })

  await supabase
    .from('engage_teams')
    .update({ score: Number(team?.score ?? 0) + result.points, streak: result.nextStreak })
    .eq('id', teamId)

  await supabase.from('session_responses').insert({
    session_id: sessionId,
    question_index: questionIndex,
    answer: answerLabel,
    is_correct: check.unscored ? null : correct,
    points_earned: result.points,
    team_id: teamId,
  })

  return { points: result.points, correct, streak: result.nextStreak }
}

export type { TeamModeSettings } from '@/lib/engage-teams'
