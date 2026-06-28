import { supabase } from '@/lib/supabase'
import { TEAM_PRESETS, assignTeamIndex } from '@/lib/engage-teams'
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

  const { data, error } = await supabase.from('engage_teams').insert(teams).select()
  if (error || !data) return []
  return data as EngageTeam[]
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
  correctAnswer: string,
  basePoints: number,
  consensusBonus: boolean,
  memberCount: number,
): Promise<{ points: number; consensus: boolean }> {
  const members = await getTeamMembers(sessionId, teamId)
  const votes = members.map(m => m.team_vote)
  const teamAnswer = majorityAnswer(votes)
  const correct = teamAnswer === correctAnswer
  const allAgree = votes.length > 0 && votes.every(v => v === teamAnswer)
  let points = correct ? basePoints : 0
  if (correct && consensusBonus && allAgree && memberCount > 1) points += 50

  if (correct) {
    const { data: team } = await supabase.from('engage_teams').select('score').eq('id', teamId).single()
    await supabase.from('engage_teams').update({ score: (team?.score ?? 0) + points }).eq('id', teamId)
  }

  await supabase.from('session_responses').insert({
    session_id: sessionId,
    participant_id: members[0]?.id,
    question_index: questionIndex,
    answer: teamAnswer,
    is_correct: correct,
    points_earned: points,
    team_id: teamId,
  })

  await supabase.from('session_participants').update({ team_vote: null }).eq('team_id', teamId)

  return { points, consensus: allAgree && correct }
}

export type { TeamModeSettings } from '@/lib/engage-teams'
