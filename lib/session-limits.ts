import { supabase } from './supabase'
import { getEffectivePlanId, getUserPlan } from './subscription'

export interface SessionJoinCheck {
  allowed: boolean
  reason?: string
  cap: number | null
  current: number
}

async function resolveHostPlan(hostUserId: string) {
  const planId = await getEffectivePlanId(hostUserId)
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('session_student_cap')
    .eq('id', planId)
    .single()
  return { planId, cap: plan?.session_student_cap ?? null }
}

/** Check whether another participant can join an Engage session. */
export async function checkEngageSessionJoin(sessionId: string): Promise<SessionJoinCheck> {
  const { data: session } = await supabase
    .from('engage_sessions')
    .select('host_id')
    .eq('id', sessionId)
    .single()

  if (!session?.host_id) {
    return { allowed: false, reason: 'Session host could not be verified.', cap: null, current: 0 }
  }

  const { cap } = await resolveHostPlan(session.host_id)

  const { count } = await supabase
    .from('session_participants')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const current = count ?? 0

  if (cap !== null && current >= cap) {
    return {
      allowed: false,
      reason: `This session is full (${cap} students max on the host's plan). Ask your teacher to upgrade or start a new session.`,
      cap,
      current,
    }
  }

  return { allowed: true, cap, current }
}

/** Check whether another student can start an Assess exam submission. */
export async function checkAssessSessionJoin(sessionId: string): Promise<SessionJoinCheck> {
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('invigilator_id')
    .eq('id', sessionId)
    .single()

  if (!session?.invigilator_id) {
    return { allowed: false, reason: 'Exam session could not be verified.', cap: null, current: 0 }
  }

  const { cap } = await resolveHostPlan(session.invigilator_id)

  const { count } = await supabase
    .from('exam_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_session_id', sessionId)

  const current = count ?? 0

  if (cap !== null && current >= cap) {
    return {
      allowed: false,
      reason: `This exam session is full (${cap} students max on the invigilator's plan). Contact your teacher.`,
      cap,
      current,
    }
  }

  return { allowed: true, cap, current }
}

/** Load session cap for the current user (host view). */
export async function getHostSessionCap(userId?: string): Promise<number | null> {
  const uid = userId ?? (await import('./auth')).getCurrentUser().id
  const { cap } = await resolveHostPlan(uid)
  return cap
}
