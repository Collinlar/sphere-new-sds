import { supabase } from '@/lib/supabase'
import { generateTicketCode } from '@/lib/codes'
import type { Exam } from '@/lib/types'

export interface TicketWithStudent {
  code: string
  name: string
  email?: string
}

export async function generateTicketsForSession(sessionId: string, exam: Exam): Promise<TicketWithStudent[]> {
  if (exam.audience !== 'roster_ticket' || !exam.roster_id) return []

  const { data: members } = await supabase
    .from('roster_members')
    .select('user_id, groups, users(name, email)')
    .eq('roster_id', exam.roster_id)
    .eq('status', 'active')

  if (!members) return []

  const filtered = (exam.audience_groups && exam.audience_groups.length > 0)
    ? members.filter(m => (m.groups ?? []).some((g: string) => exam.audience_groups!.includes(g)))
    : members

  const tickets: TicketWithStudent[] = []

  for (const member of filtered) {
    const user = member.users as unknown as { name: string; email: string }
    const code = generateTicketCode()
    const { error } = await supabase.from('exam_tickets').insert({
      exam_session_id: sessionId,
      user_id: member.user_id,
      code,
    })
    if (!error) tickets.push({ code, name: user?.name, email: user?.email })
  }

  return tickets
}
