import { supabase } from '@/lib/supabase'

export type JoinResolveResult =
  | { ok: true; href: string }
  | { ok: false; error: string }

/** Resolve a session / ticket code to the student player URL. */
export async function resolveJoinCode(raw: string): Promise<JoinResolveResult> {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) {
    return { ok: false, error: 'Enter the code your teacher shared.' }
  }

  const { data: engageSession } = await supabase
    .from('engage_sessions')
    .select('id, status')
    .eq('join_code', trimmed)
    .maybeSingle()

  if (engageSession) {
    if (engageSession.status === 'ended') {
      return { ok: false, error: 'That game has already ended. Ask your teacher for a new code.' }
    }
    return { ok: true, href: `/student/engage/${trimmed}` }
  }

  const { data: examSession } = await supabase
    .from('exam_sessions')
    .select('id, status')
    .eq('join_code', trimmed)
    .maybeSingle()

  if (examSession) {
    if (examSession.status === 'completed') {
      return { ok: false, error: 'That exam has already closed. Check with your teacher.' }
    }
    return { ok: true, href: `/student/assess/${trimmed}` }
  }

  const { data: ticket } = await supabase
    .from('exam_tickets')
    .select('id')
    .eq('code', trimmed)
    .maybeSingle()

  if (ticket) {
    return { ok: true, href: `/student/assess/${trimmed}` }
  }

  return { ok: false, error: 'We could not find that code. Check it and try again.' }
}
