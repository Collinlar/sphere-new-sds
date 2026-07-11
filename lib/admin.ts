import { supabase } from './supabase'
import { getMarketplaceCreatorEligibility, type EligibilityStatus } from './creator-eligibility'

export async function adminGetStats() {
  const [
    { count: totalInstitutions },
    { count: totalUsers },
    { count: totalMembers },
    { count: pendingCreators },
    { count: pendingListings },
    { count: guestUnclaimed },
    { count: pendingPayouts },
    { data: recentSignups },
  ] = await Promise.all([
    supabase.from('institutions').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'membership'),
    supabase.from('creator_profiles').select('id', { count: 'exact', head: true }).eq('is_approved', false).is('rejected_at', null),
    supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('guest_sessions').select('id', { count: 'exact', head: true }).is('claimed_by', null).lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('marketplace_payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
    supabase.from('users').select('created_at').gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString()).order('created_at', { ascending: false }),
  ])

  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const signupsThisWeek = (recentSignups ?? []).filter(u => new Date(u.created_at).getTime() > weekAgo).length
  const signupsLastWeek = (recentSignups ?? []).filter(u => new Date(u.created_at).getTime() <= weekAgo).length

  return {
    totalInstitutions: totalInstitutions ?? 0,
    totalUsers: totalUsers ?? 0,
    totalMembers: totalMembers ?? 0,
    pendingApprovals: (pendingCreators ?? 0) + (pendingListings ?? 0),
    pendingCreators: pendingCreators ?? 0,
    pendingListings: pendingListings ?? 0,
    guestUnclaimed: guestUnclaimed ?? 0,
    pendingPayouts: pendingPayouts ?? 0,
    signupsThisWeek,
    signupsLastWeek,
  }
}

// ── Creator payouts (admin management) ──

const CLEARANCE_DAYS = 7

export interface AdminPayoutRequest {
  id: string
  creatorId: string
  creatorName: string
  creatorEmail: string
  amountGhs: number
  status: string
  method: string | null
  destination: string | null
  requestedAt: string
  paidAt: string | null
}

export interface AdminCreatorEarning {
  creatorId: string
  creatorName: string
  creatorEmail: string
  lifetimeEarningsGhs: number   // net creator earnings, all completed sales
  clearedGhs: number            // earnings past the clearance window
  paidOutGhs: number            // already requested or paid
  owedGhs: number               // cleared minus paid out
  sales: number
}

export async function adminGetPayoutRequests(): Promise<AdminPayoutRequest[]> {
  const { data } = await supabase
    .from('marketplace_payout_requests')
    .select('id, creator_id, amount_ghs, status, method, destination, requested_at, paid_at, users(name, email)')
    .order('requested_at', { ascending: false })

  return (data ?? []).map(r => {
    const u = (r as unknown as { users?: { name: string; email: string } }).users
    return {
      id: r.id as string,
      creatorId: r.creator_id as string,
      creatorName: u?.name ?? 'Creator',
      creatorEmail: u?.email ?? '',
      amountGhs: Number(r.amount_ghs ?? 0),
      status: (r.status as string) ?? 'requested',
      method: (r.method as string) ?? null,
      destination: (r.destination as string) ?? null,
      requestedAt: r.requested_at as string,
      paidAt: (r.paid_at as string) ?? null,
    }
  })
}

export async function adminSetPayoutStatus(id: string, status: 'paid' | 'rejected'): Promise<{ ok: boolean }> {
  const patch: Record<string, unknown> = { status }
  if (status === 'paid') patch.paid_at = new Date().toISOString()
  const { error } = await supabase.from('marketplace_payout_requests').update(patch).eq('id', id)
  return { ok: !error }
}

// Per-creator earnings across all sellers, so staff can see who is owed what.
export async function adminGetCreatorEarnings(): Promise<AdminCreatorEarning[]> {
  // Map each listing to its creator.
  const { data: listings } = await supabase
    .from('marketplace_listings')
    .select('id, creator_id')
  const listingToCreator = new Map<string, string>()
  const creatorIds = new Set<string>()
  for (const l of listings ?? []) {
    if (l.creator_id) { listingToCreator.set(l.id as string, l.creator_id as string); creatorIds.add(l.creator_id as string) }
  }

  const { data: purchases } = await supabase
    .from('marketplace_purchases')
    .select('listing_id, creator_earnings_ghs, purchased_at')
    .eq('payment_status', 'completed')
    .limit(5000)

  const clearanceCutoff = Date.now() - CLEARANCE_DAYS * 86400000
  const agg = new Map<string, { lifetime: number; cleared: number; sales: number }>()
  for (const p of purchases ?? []) {
    const cid = p.listing_id ? listingToCreator.get(p.listing_id as string) : undefined
    if (!cid) continue
    const earn = Number(p.creator_earnings_ghs ?? 0)
    const a = agg.get(cid) ?? { lifetime: 0, cleared: 0, sales: 0 }
    a.lifetime += earn
    a.sales += 1
    if (new Date(p.purchased_at).getTime() < clearanceCutoff) a.cleared += earn
    agg.set(cid, a)
  }

  // Already-requested / paid amounts per creator.
  const { data: payouts } = await supabase
    .from('marketplace_payout_requests')
    .select('creator_id, amount_ghs, status')
    .in('status', ['requested', 'paid'])
  const paidByCreator = new Map<string, number>()
  for (const r of payouts ?? []) {
    paidByCreator.set(r.creator_id as string, (paidByCreator.get(r.creator_id as string) ?? 0) + Number(r.amount_ghs ?? 0))
  }

  const ids = Array.from(agg.keys())
  const names = new Map<string, { name: string; email: string }>()
  if (ids.length) {
    const { data: users } = await supabase.from('users').select('id, name, email').in('id', ids)
    for (const u of users ?? []) names.set(u.id as string, { name: (u.name as string) ?? 'Creator', email: (u.email as string) ?? '' })
  }

  return ids.map(cid => {
    const a = agg.get(cid)!
    const paid = paidByCreator.get(cid) ?? 0
    return {
      creatorId: cid,
      creatorName: names.get(cid)?.name ?? 'Creator',
      creatorEmail: names.get(cid)?.email ?? '',
      lifetimeEarningsGhs: Math.round(a.lifetime),
      clearedGhs: Math.round(a.cleared),
      paidOutGhs: Math.round(paid),
      owedGhs: Math.max(0, Math.round(a.cleared - paid)),
      sales: a.sales,
    }
  }).sort((x, y) => y.owedGhs - x.owedGhs)
}

// ── Marketplace-route creator standing (30-day minimum listings rule) ──

export interface AdminMarketplaceCreator {
  userId: string
  name: string
  email: string
  slug: string | null
  suspended: boolean
  status: EligibilityStatus
  creations: number
  required: number
  shortfall: number
  daysIntoWindow: number
  windowDays: number
}

export async function adminGetMarketplaceCreatorsStanding(): Promise<AdminMarketplaceCreator[]> {
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('subscription_tier', 'creator_marketplace')

  if (!users?.length) return []

  const ids = users.map(u => u.id as string)
  const { data: profiles } = await supabase
    .from('creator_profiles')
    .select('user_id, slug, marketplace_route_active')
    .in('user_id', ids)

  const profileByUser = new Map(
    (profiles ?? []).map(p => [p.user_id as string, { slug: p.slug as string | null, active: p.marketplace_route_active as boolean | null }])
  )

  const results = await Promise.all(users.map(async u => {
    const eligibility = await getMarketplaceCreatorEligibility(u.id as string)
    const profile = profileByUser.get(u.id as string)
    return {
      userId: u.id as string,
      name: (u.name as string) ?? 'Creator',
      email: (u.email as string) ?? '',
      slug: profile?.slug ?? null,
      suspended: profile?.active === false,
      status: eligibility.status,
      creations: eligibility.creations,
      required: eligibility.required,
      shortfall: eligibility.shortfall,
      daysIntoWindow: eligibility.daysIntoWindow,
      windowDays: eligibility.windowDays,
    }
  }))

  // Lapsed and suspended first, then warning, then ok.
  const rank: Record<string, number> = { lapsed: 0, warning: 1, ok: 2, not_marketplace: 3 }
  return results.sort((a, b) => {
    if (a.suspended !== b.suspended) return a.suspended ? -1 : 1
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
  })
}

export async function adminSetCreatorMarketplaceStanding(userId: string, active: boolean): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('creator_profiles')
    .update({
      marketplace_route_active: active,
      suspended_at: active ? null : new Date().toISOString(),
    })
    .eq('user_id', userId)

  // Reinstating brings back any listings the grace expiry took down.
  if (!error && active) {
    await supabase
      .from('marketplace_listings')
      .update({ status: 'approved' })
      .eq('creator_id', userId)
      .eq('status', 'suspended')
  }

  return { ok: !error }
}

export async function adminGetMarketplaceRevenue() {
  const { data } = await supabase
    .from('marketplace_purchases')
    .select('price_ghs, purchased_at, commission_ghs')
    .order('purchased_at', { ascending: false })
    .limit(500)

  const purchases = data ?? []
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const thisMonth = purchases.filter(p => p.purchased_at >= monthAgo)

  return {
    revenueThisMonth: thisMonth.reduce((s, p) => s + (p.commission_ghs ?? 0), 0),
    salesThisMonth: thisMonth.length,
    totalRevenue: purchases.reduce((s, p) => s + (p.commission_ghs ?? 0), 0),
  }
}
