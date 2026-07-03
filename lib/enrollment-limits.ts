import { supabase } from './supabase'

export interface EnrollmentCapCheck {
  allowed: boolean
  reason?: string
  cap: number | null
  current: number
  remaining: number | null
}

function normalisePlanId(planId: string | null | undefined): string {
  if (planId === 'trial') return 'membership'
  return planId ?? 'membership'
}

/** Count active roster members across all rosters in an institution. */
export async function countInstitutionStudents(institutionId: string): Promise<number> {
  const { data: rosters } = await supabase
    .from('rosters')
    .select('id')
    .eq('institution_id', institutionId)

  if (!rosters?.length) return 0

  const rosterIds = rosters.map(r => r.id)
  const { count } = await supabase
    .from('roster_members')
    .select('user_id', { count: 'exact', head: true })
    .in('roster_id', rosterIds)
    .eq('status', 'active')

  return count ?? 0
}

export async function checkEnrolledStudentCapacity(
  institutionId: string,
  additional = 1
): Promise<EnrollmentCapCheck> {
  const { data: institution } = await supabase
    .from('institutions')
    .select('subscription_plan')
    .eq('id', institutionId)
    .single()

  const planId = normalisePlanId(institution?.subscription_plan)
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('enrolled_student_cap')
    .eq('id', planId)
    .single()

  const cap = plan?.enrolled_student_cap ?? null

  if (cap === null) {
    return { allowed: true, cap: null, current: 0, remaining: null }
  }

  const current = await countInstitutionStudents(institutionId)
  const remaining = Math.max(cap - current, 0)

  if (current + additional > cap) {
    return {
      allowed: false,
      reason: `Your institution plan allows ${cap} enrolled students. You have ${current} and are trying to add ${additional} more. Contact Sphere to expand capacity.`,
      cap,
      current,
      remaining,
    }
  }

  return { allowed: true, cap, current, remaining: remaining - additional }
}
