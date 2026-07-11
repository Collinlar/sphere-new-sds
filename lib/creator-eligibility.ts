import { supabase } from './supabase'

// Marketplace-route creators (commission-only, no quarterly fee) must publish
// a minimum number of listings within a rolling window, or their creator
// standing lapses. This module reports status; suspension itself is a
// deliberate admin action. Two self-serve ways back exist:
//   1. Publish-back: during suspension, reaching the minimum again
//      auto-restores standing.
//   2. Upgrade: switching to Creator Quarterly bypasses the rule entirely
//      (the publish gate only checks suspension for creator_marketplace).

export const MARKETPLACE_MIN_CREATIONS = 10
export const MARKETPLACE_WINDOW_DAYS = 30
// Suspended creators keep their listings live this long before auto-delist.
export const SUSPENSION_GRACE_DAYS = 14

export type EligibilityStatus = 'ok' | 'warning' | 'lapsed' | 'not_marketplace'

export interface CreatorEligibility {
  status: EligibilityStatus
  creations: number
  required: number
  windowDays: number
  daysIntoWindow: number
  shortfall: number
  suspended: boolean
  graceDaysLeft: number | null   // days until listings auto-delist (when suspended)
}

// Count a creator's listings published within the window and compare to the
// minimum. "warning" once the window is more than half gone and they are
// still short; "lapsed" when the full window has passed under target.
export async function getMarketplaceCreatorEligibility(userId: string): Promise<CreatorEligibility> {
  const notApplicable: CreatorEligibility = {
    status: 'not_marketplace',
    creations: 0,
    required: MARKETPLACE_MIN_CREATIONS,
    windowDays: MARKETPLACE_WINDOW_DAYS,
    daysIntoWindow: 0,
    shortfall: 0,
    suspended: false,
    graceDaysLeft: null,
  }

  const { data: tierRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  if (tierRow?.subscription_tier !== 'creator_marketplace') return notApplicable

  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('created_at, marketplace_route_active, suspended_at')
    .eq('user_id', userId)
    .maybeSingle()

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - MARKETPLACE_WINDOW_DAYS)

  const { count } = await supabase
    .from('marketplace_listings')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', userId)
    .gte('created_at', windowStart.toISOString())

  const creations = count ?? 0
  const shortfall = Math.max(0, MARKETPLACE_MIN_CREATIONS - creations)

  // The 30-day clock anchors on when the user switched to the marketplace
  // route (their subscription start), falling back to profile creation.
  // Newer creators get slack: no lapse until a full window has elapsed.
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('started_at')
    .eq('user_id', userId)
    .eq('plan_id', 'creator_marketplace')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const anchor = sub?.started_at
    ? new Date(sub.started_at)
    : profile?.created_at
      ? new Date(profile.created_at)
      : windowStart
  const msIntoWindow = Date.now() - Math.max(anchor.getTime(), windowStart.getTime())
  const daysIntoWindow = Math.max(0, Math.floor(msIntoWindow / (1000 * 60 * 60 * 24)))

  let status: EligibilityStatus = 'ok'
  if (shortfall > 0) {
    if (daysIntoWindow >= MARKETPLACE_WINDOW_DAYS) status = 'lapsed'
    else if (daysIntoWindow >= MARKETPLACE_WINDOW_DAYS / 2) status = 'warning'
  }

  let suspended = profile?.marketplace_route_active === false
  let graceDaysLeft: number | null = null

  if (suspended) {
    // Publish-back: meeting the minimum while suspended restores standing.
    if (creations >= MARKETPLACE_MIN_CREATIONS) {
      await supabase
        .from('creator_profiles')
        .update({ marketplace_route_active: true, suspended_at: null })
        .eq('user_id', userId)
      suspended = false
    } else if (profile?.suspended_at) {
      const elapsedDays = Math.floor((Date.now() - new Date(profile.suspended_at).getTime()) / 86400000)
      graceDaysLeft = Math.max(0, SUSPENSION_GRACE_DAYS - elapsedDays)
      // Grace expired: existing listings come down until reinstated.
      if (graceDaysLeft === 0) {
        await supabase
          .from('marketplace_listings')
          .update({ status: 'suspended' })
          .eq('creator_id', userId)
          .eq('status', 'approved')
      }
    } else {
      graceDaysLeft = SUSPENSION_GRACE_DAYS
    }
  }

  // Record that we checked (best effort). Never touches the suspension flag —
  // that belongs to admin actions and the publish-back path above.
  await supabase
    .from('creator_profiles')
    .update({ last_creation_check: new Date().toISOString() })
    .eq('user_id', userId)

  return {
    status,
    creations,
    required: MARKETPLACE_MIN_CREATIONS,
    windowDays: MARKETPLACE_WINDOW_DAYS,
    daysIntoWindow,
    shortfall,
    suspended,
    graceDaysLeft,
  }
}
