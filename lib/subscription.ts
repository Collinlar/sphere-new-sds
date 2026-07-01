import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { SubscriptionTier, CreationUsage, SubscriptionPlan } from './types'

export type Module = 'assess' | 'engage' | 'learn' | 'train'

// Fetch the active plan record for the current user.
// Falls back to 'membership' if no subscription row exists.
export async function getUserPlan(): Promise<SubscriptionPlan | null> {
  const user = getCurrentUser()
  const tier: SubscriptionTier = (user as { subscription_tier?: SubscriptionTier }).subscription_tier ?? 'membership'

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

  const { data } = await supabase
    .from('creation_usage')
    .select('*')
    .eq('user_id', uid)
    .single()

  if (data) return data

  // First time — create row with membership defaults
  const { data: created } = await supabase
    .from('creation_usage')
    .insert({ user_id: uid, assess_quota: 5, engage_quota: 5, learn_quota: 0, train_quota: 0 })
    .select()
    .single()

  return created ?? null
}

// Check whether the user can create one more resource in the given module.
// Returns { allowed, reason } so callers can show a specific message.
export async function canCreate(module: Module): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan()
  if (!plan) return { allowed: false, reason: 'Could not load your plan. Try again.' }

  const usage = await getCreationUsage()
  if (!usage) return { allowed: false, reason: 'Could not load your usage. Try again.' }

  // Institution and marketplace-route creators have unlimited creations
  if (plan.id === 'institution' || plan.id === 'creator_marketplace') {
    return { allowed: true }
  }

  const quota = usage[`${module}_quota` as keyof CreationUsage] as number
  const used = usage[`${module}_used` as keyof CreationUsage] as number

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
export async function incrementUsed(module: Module, userId?: string): Promise<void> {
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

// Check the session student cap for the user's plan.
// Returns null if the plan has no cap (unlimited).
export async function getSessionStudentCap(): Promise<number | null> {
  const plan = await getUserPlan()
  return plan?.session_student_cap ?? null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
