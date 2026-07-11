import { supabase } from './supabase'
import { countInstitutionStudents } from './enrollment-limits'

// Per-head price per quarter for enrolled students above an institution's
// included cap, counted at billing date. Matches the Institution plan's
// quarterly billing (GHS 1,000/quarter includes 100 students).
// Override with INSTITUTION_PER_HEAD_GHS on the server.
export const INSTITUTION_PER_HEAD_GHS = 2

export function resolvePerHeadGhs(): number {
  const raw = process.env.INSTITUTION_PER_HEAD_GHS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : INSTITUTION_PER_HEAD_GHS
}

export interface EnrollmentBilling {
  planId: string
  cap: number | null       // included enrolled students; null = unlimited
  current: number          // active enrolled students now (billing-date headcount)
  included: number         // how many fall within the cap
  overage: number          // students above the cap
  perHeadGhs: number       // per student per quarter
  overagePeriodGhs: number // overage * perHead, billed with the quarter
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
    overagePeriodGhs: metered ? overage * perHeadGhs : 0,
    metered,
  }
}

// ── Per-head overage invoicing (admin action) ──

export interface OverageInvoice {
  id: string
  period: string
  overageCount: number
  perHeadGhs: number
  amountGhs: number
  status: 'billed' | 'paid'
  billedAt: string
  paidAt: string | null
}

// Overage bills quarterly, alongside the Institution plan's billing period.
function currentPeriod(): string {
  const d = new Date()
  const quarter = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${quarter}`
}

export async function getOverageInvoices(institutionId: string): Promise<OverageInvoice[]> {
  const { data } = await supabase
    .from('institution_overage_invoices')
    .select('id, period, overage_count, per_head_ghs, amount_ghs, status, billed_at, paid_at')
    .eq('institution_id', institutionId)
    .order('period', { ascending: false })

  return (data ?? []).map(r => ({
    id: r.id as string,
    period: r.period as string,
    overageCount: r.overage_count as number,
    perHeadGhs: Number(r.per_head_ghs),
    amountGhs: Number(r.amount_ghs),
    status: r.status as 'billed' | 'paid',
    billedAt: r.billed_at as string,
    paidAt: (r.paid_at as string) ?? null,
  }))
}

// Record the current quarter's overage as billed, counted at billing date.
// Idempotent per institution per period (unique constraint) — re-billing
// the same quarter updates the row.
export async function markOverageBilled(
  institutionId: string,
  billedBy: string,
  billing: EnrollmentBilling
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!billing.metered || billing.overage <= 0) {
    return { ok: false, error: 'There is no overage to bill for this institution right now.' }
  }

  const period = currentPeriod()
  const { error } = await supabase.from('institution_overage_invoices').upsert({
    institution_id: institutionId,
    period,
    overage_count: billing.overage,
    per_head_ghs: billing.perHeadGhs,
    amount_ghs: billing.overagePeriodGhs,
    status: 'billed',
    billed_at: new Date().toISOString(),
    billed_by: billedBy,
  }, { onConflict: 'institution_id,period' })

  if (error) return { ok: false, error: 'Could not record this invoice. Try again.' }

  // Mirror into the unified invoices list so it shows alongside deposits and
  // receipts. Idempotent: clear any unpaid overage invoice for this period
  // first so re-billing the quarter doesn't stack duplicates.
  await supabase
    .from('institution_invoices')
    .delete()
    .eq('institution_id', institutionId)
    .eq('invoice_type', 'overage')
    .eq('period', period)
    .neq('status', 'paid')
  await supabase.from('institution_invoices').insert({
    institution_id: institutionId,
    invoice_type: 'overage',
    description: `Enrolled-student overage — ${billing.overage} over ${billing.cap} at GH₵ ${billing.perHeadGhs} each`,
    amount_ghs: billing.overagePeriodGhs,
    period,
    status: 'sent',
    issued_by: billedBy,
  })

  return { ok: true }
}

export async function markOverageInvoicePaid(invoiceId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('institution_overage_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)
  return { ok: !error }
}
