import { supabase } from './supabase'
import { getCachedUserId, getCurrentUser } from './auth'
import { getActiveContext, canCreateContent } from './context'
import { upsertCreationUsageForPlan, nextPeriodStartIfDue, quotaRenewsAt, MEMBERSHIP_QUOTAS } from './plan-upgrade'
import {
  getEffectiveModules,
  getPlanIncludedModules,
  isModuleAccessible,
  MEMBERSHIP_ENGAGE_SESSION_QUOTA,
  parseInstitutionModules,
  type ModuleKey,
} from './institution-modules'
import type { SubscriptionTier, CreationUsage, SubscriptionPlan } from './types'
import type { AddOnId } from './types'

export interface AddOnCheckResult {
  allowed: boolean
  reason?: string
  needsPlanUpgrade?: boolean
}

export type Module = 'assess' | 'engage' | 'learn' | 'train'

function normalisePlanId(planId: string | null | undefined): SubscriptionTier {
  if (planId === 'trial') return 'membership'
  if (
    planId === 'membership' ||
    planId === 'creator_quarterly' ||
    planId === 'creator_marketplace' ||
    planId === 'institution'
  ) {
    return planId
  }
  return 'membership'
}

/** Resolve the authenticated user id from session, falling back to cached profile. */
export async function resolveAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user?.id) return data.session.user.id
  return getCachedUserId()
}

// Institution admins inherit the institution subscription plan in institution context only.
export async function getEffectivePlanId(userId?: string): Promise<SubscriptionTier> {
  const ctx = getActiveContext()
  const uid = userId ?? (await resolveAuthUserId())
  if (!uid) return 'membership'

  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', uid)
    .maybeSingle()

  if (!user) return 'membership'

  if (ctx.type === 'institution') {
    const { data: institution } = await supabase
      .from('institutions')
      .select('subscription_plan')
      .eq('id', ctx.institutionId)
      .single()

    if (institution?.subscription_plan) {
      return normalisePlanId(institution.subscription_plan)
    }
  }

  return normalisePlanId(user.subscription_tier)
}

// Fetch the active plan record for the current user.
// Falls back to 'membership' if no subscription row exists.
export async function getUserPlan(userId?: string): Promise<SubscriptionPlan | null> {
  const tier = await getEffectivePlanId(userId)

  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', tier)
    .single()

  return data ?? null
}

// Fetch or initialise creation usage row for the current user.
export async function getCreationUsage(userId?: string): Promise<CreationUsage | null> {
  const uid = userId ?? (await resolveAuthUserId()) ?? getCurrentUser().id
  const planId = await getEffectivePlanId(uid)

  const { data } = await supabase
    .from('creation_usage')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()

  let row = data

  if (row) {
    // Lazy period reset: quotas renew monthly (membership) or quarterly
    // (creator_quarterly). Applied on read so no scheduled job is needed.
    const freshStart = nextPeriodStartIfDue(planId, row.period_start ?? null)
    if (freshStart) {
      const reset = {
        assess_used: 0,
        engage_used: 0,
        learn_used: 0,
        train_used: 0,
        period_start: freshStart.toISOString(),
      }
      await supabase.from('creation_usage').update(reset).eq('user_id', uid)
      row = { ...row, ...reset }
    }
  } else {
    // No usage row yet: seed one from the plan defaults, then read it back.
    const seeded = await upsertCreationUsageForPlan(supabase, uid, planId, { resetUsed: true })
    if (!seeded.ok) return null
    const { data: created } = await supabase
      .from('creation_usage')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()
    if (!created) return null
    row = created
  }

  // Membership is the only per-module-quota plan (paid plans are either
  // unlimited or pool-based). Read its quotas live from subscription_plans so
  // an admin edit takes effect immediately for display, matching how
  // canCreate already enforces them. Fall back to the seeded constants.
  if (planId === 'membership') {
    const planRow = await getUserPlan(uid)
    return {
      ...row,
      assess_quota: planRow?.assess_quota ?? MEMBERSHIP_QUOTAS.assess_quota,
      engage_quota: planRow?.engage_quota ?? MEMBERSHIP_QUOTAS.engage_quota,
      learn_quota: planRow?.learn_quota ?? MEMBERSHIP_QUOTAS.learn_quota,
      train_quota: planRow?.train_quota ?? MEMBERSHIP_QUOTAS.train_quota,
    }
  }

  return row
}

// Whether the current user can access a module (plan allowance ∩ institution provision).
export async function canAccessModule(module: Module): Promise<boolean> {
  const planId = await getEffectivePlanId()
  const ctx = getActiveContext()

  if (ctx.type === 'institution') {
    const { data: institution } = await supabase
      .from('institutions')
      .select('modules, subscription_plan')
      .eq('id', ctx.institutionId)
      .single()

    if (!institution) {
      return getPlanIncludedModules(planId).includes(module as ModuleKey)
    }

    const provisioned = parseInstitutionModules(institution.modules)
    const instPlan =
      institution.subscription_plan === 'trial'
        ? 'membership'
        : (institution.subscription_plan ?? planId)

    return isModuleAccessible(module as ModuleKey, provisioned, instPlan)
  }

  return getPlanIncludedModules(planId).includes(module as ModuleKey)
}

// Check whether the user can create one more resource in the given module.
// Returns { allowed, reason } so callers can show a specific message.
export async function canCreate(module: Module): Promise<{ allowed: boolean; reason?: string }> {
  const ctx = getActiveContext()
  if (ctx.type === 'institution') {
    if (!canCreateContent(ctx)) {
      return { allowed: false, reason: 'Students cannot create content inside an institution. Switch to your Personal workspace to create your own.' }
    }
    const { data: institution } = await supabase
      .from('institutions')
      .select('modules, subscription_plan')
      .eq('id', ctx.institutionId)
      .single()
    const provisioned = parseInstitutionModules(institution?.modules)
    const instPlan = institution?.subscription_plan === 'trial'
      ? 'membership'
      : (institution?.subscription_plan ?? 'membership')
    if (!isModuleAccessible(module as ModuleKey, provisioned, instPlan)) {
      return {
        allowed: false,
        reason:
          instPlan === 'membership'
            ? `${capitalize(module)} is for Creator and Institution plans. Upgrade ${ctx.institutionName} from Plan and billing.`
            : `${capitalize(module)} is not active for ${ctx.institutionName}. An admin can enable it from Settings.`,
      }
    }

    if (instPlan === 'institution' || instPlan === 'creator_marketplace') {
      return { allowed: true }
    }

    if (instPlan === 'membership' && module === 'engage') {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `${capitalize(module)} needs a Creator or Institution plan for ${ctx.institutionName}. Upgrade from Plan and billing.`,
    }
  }

  const uid = await resolveAuthUserId()
  const plan = await getUserPlan(uid ?? undefined)
  if (!plan) return { allowed: false, reason: 'Could not load your plan. Try again.' }

  const hasModule = await canAccessModule(module)
  if (!hasModule) {
    return {
      allowed: false,
      reason:
        module === 'engage'
          ? 'Your plan does not include Engage. Upgrade to Creator or Institution to unlock it.'
          : `${capitalize(module)} is for Creator and Institution plans. Upgrade from Plan and billing to unlock it.`,
    }
  }

  if (plan.id === 'membership' && module === 'engage') {
    return { allowed: true }
  }

  const usage = await getCreationUsage(uid ?? undefined)
  if (!usage) return { allowed: false, reason: 'Could not load your usage. Try again.' }

  if (plan.id === 'institution' || plan.id === 'creator_marketplace') {
    return { allowed: true }
  }

  const used = usage[`${module}_used` as keyof CreationUsage] as number
  const quotaKey = `${module}_quota` as keyof SubscriptionPlan
  const planQuota = plan[quotaKey] as number | null | undefined
  const quota =
    plan.id === 'membership'
      ? (planQuota ?? 0)
      : (usage[`${module}_quota` as keyof CreationUsage] as number)

  if (quota === 0) {
    if (plan.id === 'creator_quarterly') {
      return {
        allowed: false,
        reason: `You have 0 ${capitalize(module)} creations allocated. Redistribute your pool from Plan and billing.`,
      }
    }
    return {
      allowed: false,
      reason: `Your plan does not include ${capitalize(module)}. Upgrade to Creator or Institution to unlock it.`,
    }
  }

  if (used >= quota) {
    return {
      allowed: false,
      reason: `You have used all ${quota} of your ${capitalize(module)} creations this period.${renewalPhrase(plan.id as SubscriptionTier, usage.period_start ?? null)} Redistribute your quota or upgrade your plan.`,
    }
  }

  return { allowed: true }
}

// " Your quota renews on 3 Aug." — or empty for unlimited plans.
function renewalPhrase(planId: SubscriptionTier, periodStart: string | null): string {
  const renews = quotaRenewsAt(planId, periodStart)
  if (!renews) return ''
  return ` Your quota renews on ${renews.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
}

// When the current user's creation quota renews (null = unlimited plan).
export async function getQuotaRenewalDate(): Promise<Date | null> {
  const planId = await getEffectivePlanId()
  const usage = await getCreationUsage()
  return quotaRenewsAt(planId, usage?.period_start ?? null)
}

export async function incrementUsed(module: Module, userId?: string): Promise<void> {
  if (getActiveContext().type === 'institution') return

  const uid = userId ?? (await resolveAuthUserId()) ?? getCachedUserId() ?? getCurrentUser().id
  if (!uid || uid === '00000000-0000-0000-0000-000000000002') return

  const planId = await getEffectivePlanId(uid)
  if (planId === 'membership' && module === 'engage') return

  // RPC only updates existing rows — seed quotas first without resetting used counts.
  await upsertCreationUsageForPlan(supabase, uid, planId, { resetUsed: false })

  const field = `${module}_used` as
    | 'assess_used'
    | 'engage_used'
    | 'learn_used'
    | 'train_used'

  const { error: rpcError } = await supabase.rpc('increment_creation_used', {
    p_user_id: uid,
    p_field: field,
  })

  if (!rpcError) return

  // Fallback if RPC is unavailable: read-modify-write the usage row.
  const { data: row } = await supabase
    .from('creation_usage')
    .select(field)
    .eq('user_id', uid)
    .maybeSingle()

  const current = Number((row as Record<string, number> | null)?.[field] ?? 0)
  await supabase
    .from('creation_usage')
    .upsert(
      { user_id: uid, [field]: current + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
}

export async function incrementEngageSessionLaunched(userId?: string): Promise<void> {
  if (getActiveContext().type === 'institution') return

  const planId = await getEffectivePlanId(userId)
  if (planId !== 'membership') return

  const uid = userId ?? (await resolveAuthUserId()) ?? getCurrentUser().id
  await supabase.rpc('increment_creation_used', { p_user_id: uid, p_field: 'engage_used' })
}

export async function canLaunchEngageSession(): Promise<{ allowed: boolean; reason?: string }> {
  if (!(await canAccessModule('engage'))) {
    return {
      allowed: false,
      reason: 'Your plan does not include Engage. Upgrade to Creator or Institution to unlock live sessions.',
    }
  }

  const planId = await getEffectivePlanId()
  if (planId !== 'membership' || getActiveContext().type === 'institution') {
    return { allowed: true }
  }

  const usage = await getCreationUsage()
  if (!usage) {
    return { allowed: false, reason: 'Could not load your session usage. Try again.' }
  }

  const quota = usage.engage_quota ?? MEMBERSHIP_ENGAGE_SESSION_QUOTA
  const used = usage.engage_used ?? 0

  if (used >= quota) {
    return {
      allowed: false,
      reason: `You have used all ${quota} Engage live sessions this month.${renewalPhrase('membership', usage.period_start ?? null)} Upgrade to Creator for Assess, Learn, Train, and unlimited sessions.`,
    }
  }

  return { allowed: true }
}

export async function decrementUsed(module: Module, userId?: string): Promise<void> {
  const uid = userId ?? (await resolveAuthUserId()) ?? getCurrentUser().id
  const field = `${module}_used`

  await supabase.rpc('decrement_creation_used', { p_user_id: uid, p_field: field })
}

export async function updateQuotaAllocation(
  userId: string,
  allocation: { assess: number; engage: number; learn: number; train: number }
): Promise<{ ok: boolean; error?: string }> {
  const planId = await getEffectivePlanId(userId)
  if (planId !== 'creator_quarterly') {
    return { ok: false, error: 'Quota redistribution is only available on the Creator Quarterly plan.' }
  }

  const plan = await getUserPlan(userId)
  const total = allocation.assess + allocation.engage + allocation.learn + allocation.train
  const pool = plan?.total_creation_pool ?? 40

  if (total > pool) {
    return { ok: false, error: `Your total allocation (${total}) exceeds your pool of ${pool} creations.` }
  }

  const { error } = await supabase
    .from('creation_usage')
    .upsert(
      {
        user_id: userId,
        assess_quota: allocation.assess,
        engage_quota: allocation.engage,
        learn_quota: allocation.learn,
        train_quota: allocation.train,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { ok: false, error: 'Could not save your allocation. Try again.' }
  return { ok: true }
}

export async function canSellOnMarketplace(): Promise<boolean> {
  const plan = await getUserPlan()
  return plan?.can_sell_marketplace ?? false
}

export async function canIssueCertificates(): Promise<boolean> {
  const plan = await getUserPlan()
  return plan?.can_issue_certificates ?? false
}

export async function getUserAddOns(): Promise<string[]> {
  const uid = (await resolveAuthUserId()) ?? getCurrentUser().id
  const { data } = await supabase
    .from('user_add_ons')
    .select('add_on_id')
    .eq('user_id', uid)
    .eq('status', 'active')

  return (data ?? []).map(r => r.add_on_id)
}

export async function hasAddOn(addOnId: string): Promise<boolean> {
  const active = await getUserAddOns()
  return active.includes(addOnId)
}

export async function assertAddOnAccess(addOnId: AddOnId): Promise<AddOnCheckResult> {
  const planId = await getEffectivePlanId()

  const { data: addOn } = await supabase
    .from('add_ons')
    .select('name, eligible_plans, is_active')
    .eq('id', addOnId)
    .single()

  if (!addOn) {
    return { allowed: false, reason: 'That add-on is not available.' }
  }

  // A retired add-on has been folded into the product and is open to
  // everyone. Credits, not entitlement, decide what a generation costs.
  if (addOn.is_active === false) {
    return { allowed: true }
  }

  const eligible: string[] = addOn.eligible_plans ?? []
  if (!eligible.includes(planId)) {
    return {
      allowed: false,
      needsPlanUpgrade: true,
      reason: `${addOn.name} needs a Creator or Institution plan. Upgrade first, then add it from billing.`,
    }
  }

  if (!(await hasAddOn(addOnId))) {
    return {
      allowed: false,
      needsPlanUpgrade: false,
      reason: `Add ${addOn.name} from Plan and billing before using it.`,
    }
  }

  return { allowed: true }
}

/**
 * Passes when the user holds ANY of the given add-ons. Hints and explanations
 * ship with the builders now, so a feature can be reachable either through the
 * builder that includes it or through a legacy standalone add-on the user is
 * still subscribed to.
 */
export async function assertAnyAddOnAccess(addOnIds: AddOnId[]): Promise<AddOnCheckResult> {
  if (addOnIds.length === 0) return { allowed: false, reason: 'That add-on is not available.' }

  let lastResult: AddOnCheckResult = { allowed: false, reason: 'That add-on is not available.' }
  for (const id of addOnIds) {
    const result = await assertAddOnAccess(id)
    if (result.allowed) return result
    // Prefer the most actionable message: "add it from billing" beats
    // "upgrade your plan" when at least one option is already on their plan.
    if (!result.needsPlanUpgrade) lastResult = result
    else if (lastResult.needsPlanUpgrade !== false) lastResult = result
  }
  return lastResult
}

export async function getSessionStudentCap(): Promise<number | null> {
  const plan = await getUserPlan()
  return plan?.session_student_cap ?? null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
