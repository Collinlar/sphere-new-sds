import { supabase } from '@/lib/supabase'

export async function fetchEngageStats(quizIds: string[]): Promise<{
  totalPlays: number
  avgScore: number
}> {
  if (quizIds.length === 0) return { totalPlays: 0, avgScore: 0 }

  const { data: sessions } = await supabase
    .from('engage_sessions')
    .select('id')
    .in('quiz_id', quizIds)
    .eq('status', 'ended')

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  const totalPlays = sessionIds.length
  if (sessionIds.length === 0) return { totalPlays: 0, avgScore: 0 }

  const { data: participants } = await supabase
    .from('session_participants')
    .select('score')
    .in('session_id', sessionIds)

  const scores = (participants ?? []).map((p) => Number(p.score ?? 0))
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  return { totalPlays, avgScore }
}
