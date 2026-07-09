import { supabase } from './supabase'

// Marketplace-route creators (commission-only, no quarterly fee) must publish
// a minimum number of listings within a rolling window, or their creator
// standing lapses. This module reports status; it never downgrades an account
// on its own — suspension is a deliberate admin action.

export const MARKETPLACE_MIN_CREATIONS = 10
export const MARKETPLACE_WINDOW_DAYS = 30

export type EligibilityStatus = 'ok' | 'warning' | 'lapsed' | 'not_marketplace'

export interface CreatorEligibility {
  status: EligibilityStatus
  creations: number
  required: number
  windowDays: number
  daysIntoWindow: number
  shortfall: number
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
  }

  const { data: tierRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  if (tierRow?.subscription_tier !== 'creator_marketplace') return notApplicable

  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('created_at')
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

  // How far into the current 30-day window the creator is, based on when they
  // became a creator (proxy: profile creation). Newer creators get slack.
  const profileStart = profile?.created_at ? new Date(profile.created_at) : windowStart
  const msIntoWindow = Date.now() - Math.max(profileStart.getTime(), windowStart.getTime())
  const daysIntoWindow = Math.max(0, Math.floor(msIntoWindow / (1000 * 60 * 60 * 24)))

  let status: EligibilityStatus = 'ok'
  if (shortfall > 0) {
    if (daysIntoWindow >= MARKETPLACE_WINDOW_DAYS) status = 'lapsed'
    else if (daysIntoWindow >= MARKETPLACE_WINDOW_DAYS / 2) status = 'warning'
  }

  // Record that we checked (best effort).
  await supabase
    .from('creator_profiles')
    .update({ last_creation_check: new Date().toISOString(), marketplace_route_active: true })
    .eq('user_id', userId)

  return {
    status,
    creations,
    required: MARKETPLACE_MIN_CREATIONS,
    windowDays: MARKETPLACE_WINDOW_DAYS,
    daysIntoWindow,
    shortfall,
  }
}
