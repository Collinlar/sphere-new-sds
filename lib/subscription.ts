import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { getActiveContext, canCreateContent } from './context'
import {
  getEffectiveModules,
  getPlanIncludedModules,
  isModuleAccessible,
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

// Institution admins inherit the institution subscription plan for quotas and gates.
export async function getEffectivePlanId(userId?: string): Promise<SubscriptionTier> {
  const user = userId
    ? (await supabase.from('users').select('id, role, institution_id, subscription_tier').eq('id', userId).single()).data
    : getCurrentUser()

  if (!user) return 'membership'

  if (user.role === 'admin' && user.institution_id) {
    const { data: institution } = await supabase
      .from('institutions')
      .select('subscription_plan')
      .eq('id', user.institution_id)
      .single()

    if (institution?.subscription_plan) {
      return normalisePlanId(institution.subscription_plan)
    }
  }

  return normalisePlanId((user as { subscription_tier?: SubscriptionTier }).subscription_tier)
}

// Fetch the active plan record for the current user.
// Falls back to 'membership' if no subscription row exists.
export async function getUserPlan(): Promise<SubscriptionPlan | null> {
  const tier = await getEffectivePlanId()

  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', tier)
    .single()

  return data ?? null
}

// Fetch or initialise creation usage row for the current user.
export async function getCreationUsage(userId?: string): Promise<CreationUsage | null> {
  const uid = userId ?? getCurrentUser().id
  const planId = await getEffectivePlanId(uid)

  const { data } = await supabase
    .from('creation_usage')
    .select('*')
    .eq('user_id', uid)
    .single()

  if (data) {
    if (planId === 'membership') {
      return {
        ...data,
        assess_quota: 5,
        engage_quota: 5,
        learn_quota: 0,
        train_quota: 0,
      }
    }
    return data
  }

  const defaults =
    planId === 'membership'
      ? { assess_quota: 5, engage_quota: 5, learn_quota: 0, train_quota: 0 }
      : { assess_quota: 9999, engage_quota: 9999, learn_quota: 9999, train_quota: 9999 }

  const { data: created } = await supabase
    .from('creation_usage')
    .insert({ user_id: uid, ...defaults })
    .select()
    .single()

  return created ?? null
}

// Whether the current user can access a module (plan allowance ∩ institution provision).
export async function canAccessModule(module: Module): Promise<boolean> {
  const planId = await getEffectivePlanId()
  const user = getCurrentUser()

  if (!user.institution_id) {
    return getPlanIncludedModules(planId).includes(module as ModuleKey)
  }

  const { data: institution } = await supabase
    .from('institutions')
    .select('modules, subscription_plan')
    .eq('id', user.institution_id)
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

// Check whether the user can create one more resource in the given module.
// Returns { allowed, reason } so callers can show a specific message.
export async function canCreate(module: Module): Promise<{ allowed: boolean; reason?: string }> {
  // Institution context: quota comes from the institution, not the user.
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
      return { allowed: false, reason: `${capitalize(module)} is not active for ${ctx.institutionName}. An admin can enable it from Settings.` }
    }
    // Institution plan has unlimited creations
    return { allowed: true }
  }

  const plan = await getUserPlan()
  if (!plan) return { allowed: false, reason: 'Could not load your plan. Try again.' }

  const hasModule = await canAccessModule(module)
  if (!hasModule) {
    return {
      allowed: false,
      reason: `Your plan does not include ${capitalize(module)}. Upgrade your plan to unlock it.`,
    }
  }

  const usage = await getCreationUsage()
  if (!usage) return { allowed: false, reason: 'Could not load your usage. Try again.' }

  // Institution and marketplace-route creators have unlimited creations
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
    return {
      allowed: false,
      reason: `Your plan does not include ${capitalize(module)}. Upgrade to Creator or Institution to unlock it.`,
    }
  }

  if (used >= quota) {
    return {
      allowed: false,
      reason: `You have used all ${quota} of your ${capitalize(module)} creations. Redistribute your quota or upgrade your plan.`,
    }
  }

  return { allowed: true }
}

// Increment the used count for a module after a resource is created.
// Institution-context creations draw on the institution pool, not the
// user's personal quota, so they are not counted here.
export async function incrementUsed(module: Module, userId?: string): Promise<void> {
  if (getActiveContext().type === 'institution') return

  const uid = userId ?? getCurrentUser().id
  const field = `${module}_used`

  await supabase.rpc('increment_creation_used', { p_user_id: uid, p_field: field })
}

// Decrement the used count when a resource is deleted.
export async function decrementUsed(module: Module, userId?: string): Promise<void> {
  const uid = userId ?? getCurrentUser().id
  const field = `${module}_used`

  await supabase.rpc('decrement_creation_used', { p_user_id: uid, p_field: field })
}

// Update the quota allocation for a creator_quarterly user (pool redistribution).
// The total of all four must not exceed the plan's total_creation_pool (40).
export async function updateQuotaAllocation(
  userId: string,
  allocation: { assess: number; engage: number; learn: number; train: number }
): Promise<{ ok: boolean; error?: string }> {
  const plan = await getUserPlan()
  if (!plan || plan.id !== 'creator_quarterly') {
    return { ok: false, error: 'Quota redistribution is only available on the Creator Quarterly plan.' }
  }

  const total = allocation.assess + allocation.engage + allocation.learn + allocation.train
  const pool = plan.total_creation_pool ?? 40

  if (total > pool) {
    return { ok: false, error: `Your total allocation (${total}) exceeds your pool of ${pool} creations.` }
  }

  const { error } = await supabase
    .from('creation_usage')
    .upsert({
      user_id: userId,
      assess_quota: allocation.assess,
      engage_quota: allocation.engage,
      learn_quota: allocation.learn,
      train_quota: allocation.train,
    })

  if (error) return { ok: false, error: 'Could not save your allocation. Try again.' }
  return { ok: true }
}

// Check whether the user's active plan allows selling on the marketplace.
export async function canSellOnMarketplace(): Promise<boolean> {
  const plan = await getUserPlan()
  return plan?.can_sell_marketplace ?? false
}

// Check whether the user's active plan allows issuing certificates.
export async function canIssueCertificates(): Promise<boolean> {
  const plan = await getUserPlan()
  return plan?.can_issue_certificates ?? false
}

// Fetch all add-ons the current user has active.
export async function getUserAddOns(): Promise<string[]> {
  const user = getCurrentUser()
  const { data } = await supabase
    .from('user_add_ons')
    .select('add_on_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  return (data ?? []).map(r => r.add_on_id)
}

// Check whether the user has a specific add-on active.
export async function hasAddOn(addOnId: string): Promise<boolean> {
  const active = await getUserAddOns()
  return active.includes(addOnId)
}

/** Verify plan eligibility and active add-on before using an AI feature. */
export async function assertAddOnAccess(addOnId: AddOnId): Promise<AddOnCheckResult> {
  const planId = await getEffectivePlanId()

  const { data: addOn } = await supabase
    .from('add_ons')
    .select('name, eligible_plans')
    .eq('id', addOnId)
    .single()

  if (!addOn) {
    return { allowed: false, reason: 'That add-on is not available.' }
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

// Check the session student cap for the user's plan.
// Returns null if the plan has no cap (unlimited).
export async function getSessionStudentCap(): Promise<number | null> {
  const plan = await getUserPlan()
  return plan?.session_student_cap ?? null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
