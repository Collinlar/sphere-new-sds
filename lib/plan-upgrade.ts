import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin'
import type { SubscriptionTier } from './types'

export const CREATOR_QUARTERLY_QUOTAS = {
  assess_quota: 10,
  engage_quota: 10,
  learn_quota: 10,
  train_quota: 10,
} as const

export const UNLIMITED_QUOTAS = {
  assess_quota: 9999,
  engage_quota: 9999,
  learn_quota: 9999,
  train_quota: 9999,
} as const

export const MEMBERSHIP_QUOTAS = {
  assess_quota: 0,
  engage_quota: 5,
  learn_quota: 0,
  train_quota: 0,
} as const

/** Default per-module quotas for a plan (creation_usage columns). */
export function quotasForPlan(planId: SubscriptionTier) {
  if (planId === 'creator_quarterly') return { ...CREATOR_QUARTERLY_QUOTAS }
  if (planId === 'membership') return { ...MEMBERSHIP_QUOTAS }
  return { ...UNLIMITED_QUOTAS }
}

/**
 * How long a plan's creation quota period lasts, in months.
 * Membership renews monthly (keeps free users coming back);
 * Creator Quarterly renews with its billing quarter.
 * Unlimited plans have no period (null = never reset).
 */
export function quotaPeriodMonths(planId: SubscriptionTier): number | null {
  if (planId === 'membership') return 1
  if (planId === 'creator_quarterly') return 3
  return null
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Given when the current period started, when does the quota renew?
 * Returns null for plans without a period.
 */
export function quotaRenewsAt(planId: SubscriptionTier, periodStart: string | Date | null): Date | null {
  const months = quotaPeriodMonths(planId)
  if (!months) return null
  const start = periodStart ? new Date(periodStart) : new Date()
  return addMonths(start, months)
}

/**
 * If the period has rolled over, compute the fresh period start
 * (advanced whole periods, so a user away for 3 months lands in the
 * current window, not a stale one). Returns null when no reset is due.
 */
export function nextPeriodStartIfDue(planId: SubscriptionTier, periodStart: string | Date | null): Date | null {
  const months = quotaPeriodMonths(planId)
  if (!months) return null
  let start = periodStart ? new Date(periodStart) : new Date()
  const now = new Date()
  if (addMonths(start, months) > now) return null
  while (addMonths(start, months) <= now) {
    start = addMonths(start, months)
  }
  return start
}

export function buildCreationUsageRow(
  userId: string,
  planId: SubscriptionTier,
  options?: { resetUsed?: boolean }
) {
  const resetUsed = options?.resetUsed ?? true
  const row: Record<string, number | string> = {
    user_id: userId,
    ...quotasForPlan(planId),
  }
  if (resetUsed) {
    row.assess_used = 0
    row.engage_used = 0
    row.learn_used = 0
    row.train_used = 0
    row.period_start = new Date().toISOString()
  }
  return row
}

/** Upsert creation_usage for a plan change (client or admin Supabase). */
export async function upsertCreationUsageForPlan(
  client: SupabaseClient,
  userId: string,
  planId: SubscriptionTier,
  options?: { resetUsed?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from('creation_usage')
    .upsert(buildCreationUsageRow(userId, planId, options), { onConflict: 'user_id' })

  if (error) return { ok: false, error: 'Could not seed creation quotas.' }
  return { ok: true }
}

/** Server-side: set subscription tier and seed quotas after upgrade or admin change. */
export async function applyPlanUpgrade(
  userId: string,
  planId: SubscriptionTier,
  options?: { resetUsed?: boolean; client?: SupabaseClient }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = options?.client ?? getSupabaseAdmin()
  if (!db) return { ok: false, error: 'Database is not configured.' }

  const { error: tierError } = await db
    .from('users')
    .update({ subscription_tier: planId })
    .eq('id', userId)

  if (tierError) return { ok: false, error: 'Could not update subscription tier.' }

  return upsertCreationUsageForPlan(db, userId, planId, options)
}
