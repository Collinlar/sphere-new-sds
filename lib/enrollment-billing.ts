import { supabase } from './supabase'
import { countInstitutionStudents } from './enrollment-limits'

// Per-head monthly price for enrolled students above an institution's included
// cap. Override with INSTITUTION_PER_HEAD_GHS on the server.
export const INSTITUTION_PER_HEAD_GHS = 3

export function resolvePerHeadGhs(): number {
  const raw = process.env.INSTITUTION_PER_HEAD_GHS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : INSTITUTION_PER_HEAD_GHS
}

export interface EnrollmentBilling {
  planId: string
  cap: number | null       // included enrolled students; null = unlimited
  current: number          // active enrolled students now
  included: number         // how many fall within the cap
  overage: number          // students above the cap
  perHeadGhs: number
  overageMonthlyGhs: number // overage * perHead
  metered: boolean         // true when per-head pricing applies to this plan
}

function normalisePlanId(planId: string | null | undefined): string {
  if (planId === 'trial') return 'membership'
  return planId ?? 'membership'
}

// Billing snapshot for an institution's enrolled headcount. Only the
// Institution plan meters per-head; other plans use the hard cap enforced
// elsewhere and report metered:false.
export async function getEnrollmentBilling(institutionId: string): Promise<EnrollmentBilling> {
  const { data: institution } = await supabase
    .from('institutions')
    .select('subscription_plan')
    .eq('id', institutionId)
    .maybeSingle()

  const planId = normalisePlanId(institution?.subscription_plan)

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('enrolled_student_cap')
    .eq('id', planId)
    .maybeSingle()

  const cap = plan?.enrolled_student_cap ?? null
  const current = await countInstitutionStudents(institutionId)
  const perHeadGhs = resolvePerHeadGhs()

  // Per-head metering applies only to the Institution plan (it has a numeric
  // enrolled cap and unlimited creation). Other plans do not grow this way.
  const metered = planId === 'institution' && cap !== null

  const included = cap === null ? current : Math.min(current, cap)
  const overage = cap === null ? 0 : Math.max(0, current - cap)

  return {
    planId,
    cap,
    current,
    included,
    overage,
    perHeadGhs,
    overageMonthlyGhs: metered ? overage * perHeadGhs : 0,
    metered,
  }
}
