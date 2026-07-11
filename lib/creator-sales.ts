import { supabase } from './supabase'

// Earnings clear for payout after this many days (matches the "pending
// clearance" line in the My Sales design).
const CLEARANCE_DAYS = 7

export interface SalesListing {
  id: string
  title: string
  resource_type: string
  price_ghs: number
  is_free: boolean
  status: string
  sales: number
  revenueGhs: number   // gross (price x sales)
}

export interface RecentSale {
  id: string
  listingTitle: string
  buyerName: string
  earningsGhs: number
  purchasedAt: string
}

export interface MonthlyPoint {
  label: string        // e.g. 'Jul'
  earningsGhs: number
  isCurrent: boolean
}

export interface CreatorSalesSummary {
  hasProfile: boolean
  // Earnings
  netEarningsTotalGhs: number
  netEarningsThisMonthGhs: number
  earningsDeltaPct: number | null   // vs last month
  monthly: MonthlyPoint[]
  // KPIs
  salesThisMonth: number
  salesDeltaVsLastMonth: number
  learnersReached: number
  avgRating: number | null
  ratingCount: number
  // Payout
  availableGhs: number
  pendingGhs: number
  payoutMethod: string | null       // e.g. 'MTN MoMo · 024 xxx 88'
  // Tables / lists
  listings: SalesListing[]
  recentSales: RecentSale[]
  topEarner: { title: string; earningsGhs: number } | null
}

interface PurchaseRow {
  id: string
  listing_id: string | null
  buyer_id: string | null
  price_ghs: number | null
  creator_earnings_ghs: number | null
  purchased_at: string
  payment_status: string
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function getCreatorSalesSummary(userId: string): Promise<CreatorSalesSummary> {
  const empty: CreatorSalesSummary = {
    hasProfile: false,
    netEarningsTotalGhs: 0, netEarningsThisMonthGhs: 0, earningsDeltaPct: null, monthly: [],
    salesThisMonth: 0, salesDeltaVsLastMonth: 0, learnersReached: 0, avgRating: null, ratingCount: 0,
    availableGhs: 0, pendingGhs: 0, payoutMethod: null,
    listings: [], recentSales: [], topEarner: null,
  }

  // The creator's own listings.
  const { data: listingRows } = await supabase
    .from('marketplace_listings')
    .select('id, title, resource_type, price_ghs, is_free, status, total_purchases, total_revenue_ghs')
    .eq('creator_id', userId)
    .order('total_revenue_ghs', { ascending: false })

  const listings: SalesListing[] = (listingRows ?? []).map(l => ({
    id: l.id as string,
    title: l.title as string,
    resource_type: l.resource_type as string,
    price_ghs: Number(l.price_ghs ?? 0),
    is_free: Boolean(l.is_free),
    status: (l.status as string) ?? 'draft',
    sales: Number(l.total_purchases ?? 0),
    revenueGhs: Number(l.total_revenue_ghs ?? 0),
  }))

  const listingIds = listings.map(l => l.id)
  const profile = await getCreatorProfileMeta(userId)

  if (listingIds.length === 0) {
    return { ...empty, hasProfile: profile.hasProfile, payoutMethod: profile.payoutMethod, listings, avgRating: profile.avgRating, ratingCount: profile.ratingCount }
  }

  // Completed purchases across those listings.
  const { data: purchaseRows } = await supabase
    .from('marketplace_purchases')
    .select('id, listing_id, buyer_id, price_ghs, creator_earnings_ghs, purchased_at, payment_status')
    .in('listing_id', listingIds)
    .eq('payment_status', 'completed')
    .order('purchased_at', { ascending: false })

  const purchases = (purchaseRows ?? []) as PurchaseRow[]

  const now = new Date()
  const thisKey = monthKey(now)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastKey = monthKey(lastMonthDate)
  const clearanceCutoff = new Date(now.getTime() - CLEARANCE_DAYS * 86400000)

  let netTotal = 0, netThisMonth = 0, netLastMonth = 0
  let salesThisMonth = 0, salesLastMonth = 0
  let available = 0, pending = 0
  const monthlyMap = new Map<string, number>()
  const listingTitle = new Map(listings.map(l => [l.id, l.title]))
  const earningsByListing = new Map<string, number>()

  for (const p of purchases) {
    const earn = Number(p.creator_earnings_ghs ?? 0)
    const d = new Date(p.purchased_at)
    const k = monthKey(d)
    netTotal += earn
    monthlyMap.set(k, (monthlyMap.get(k) ?? 0) + earn)
    if (p.listing_id) earningsByListing.set(p.listing_id, (earningsByListing.get(p.listing_id) ?? 0) + earn)
    if (k === thisKey) { netThisMonth += earn; salesThisMonth += 1 }
    if (k === lastKey) { netLastMonth += earn; salesLastMonth += 1 }
    if (d < clearanceCutoff) available += earn
    else pending += earn
  }

  // Subtract earnings already requested/paid out.
  const { data: payoutRows } = await supabase
    .from('marketplace_payout_requests')
    .select('amount_ghs, status')
    .eq('creator_id', userId)
    .in('status', ['requested', 'paid'])
  const alreadyOut = (payoutRows ?? []).reduce((s, r) => s + Number(r.amount_ghs ?? 0), 0)
  available = Math.max(0, available - alreadyOut)

  // Monthly series: last 8 months in order.
  const monthly: MonthlyPoint[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly.push({
      label: MONTH_LABELS[d.getMonth()],
      earningsGhs: Math.round(monthlyMap.get(monthKey(d)) ?? 0),
      isCurrent: i === 0,
    })
  }

  const earningsDeltaPct = netLastMonth > 0
    ? Math.round(((netThisMonth - netLastMonth) / netLastMonth) * 100)
    : null

  // Learners reached: distinct buyers across all completed purchases.
  const learnersReached = new Set(purchases.map(p => p.buyer_id).filter(Boolean)).size

  // Recent sales (latest 4) with buyer names.
  const recentRaw = purchases.slice(0, 4)
  const buyerIds = Array.from(new Set(recentRaw.map(p => p.buyer_id).filter(Boolean))) as string[]
  const buyerNames = new Map<string, string>()
  if (buyerIds.length) {
    const { data: buyers } = await supabase.from('users').select('id, name').in('id', buyerIds)
    for (const b of buyers ?? []) buyerNames.set(b.id as string, (b.name as string) ?? 'A buyer')
  }
  const recentSales: RecentSale[] = recentRaw.map(p => ({
    id: p.id,
    listingTitle: (p.listing_id && listingTitle.get(p.listing_id)) || 'Resource',
    buyerName: (p.buyer_id && buyerNames.get(p.buyer_id)) || 'A buyer',
    earningsGhs: Number(p.creator_earnings_ghs ?? 0),
    purchasedAt: p.purchased_at,
  }))

  // Top earner this month.
  let topEarner: { title: string; earningsGhs: number } | null = null
  const monthEarnByListing = new Map<string, number>()
  for (const p of purchases) {
    if (monthKey(new Date(p.purchased_at)) !== thisKey || !p.listing_id) continue
    monthEarnByListing.set(p.listing_id, (monthEarnByListing.get(p.listing_id) ?? 0) + Number(p.creator_earnings_ghs ?? 0))
  }
  for (const [lid, earn] of monthEarnByListing) {
    if (!topEarner || earn > topEarner.earningsGhs) {
      topEarner = { title: listingTitle.get(lid) ?? 'Resource', earningsGhs: Math.round(earn) }
    }
  }

  return {
    hasProfile: profile.hasProfile,
    netEarningsTotalGhs: Math.round(netTotal),
    netEarningsThisMonthGhs: Math.round(netThisMonth),
    earningsDeltaPct,
    monthly,
    salesThisMonth,
    salesDeltaVsLastMonth: salesThisMonth - salesLastMonth,
    learnersReached,
    avgRating: profile.avgRating,
    ratingCount: profile.ratingCount,
    availableGhs: Math.round(available),
    pendingGhs: Math.round(pending),
    payoutMethod: profile.payoutMethod,
    listings,
    recentSales,
    topEarner,
  }
}

async function getCreatorProfileMeta(userId: string): Promise<{ hasProfile: boolean; avgRating: number | null; ratingCount: number; payoutMethod: string | null }> {
  const { data } = await supabase
    .from('creator_profiles')
    .select('id, total_sales, payout_method, payout_destination')
    .eq('user_id', userId)
    .maybeSingle()
  return {
    hasProfile: Boolean(data),
    avgRating: null,
    ratingCount: 0,
    payoutMethod: data?.payout_method && data?.payout_destination
      ? `${data.payout_method} · ${data.payout_destination}`
      : null,
  }
}

// Save (or update) the creator's preferred payout destination. The number
// is masked before storage is not required, but callers should send a
// human-readable destination like "024 xxx 88" if they want to mask it.
export async function setPayoutDestination(
  userId: string,
  method: string,
  destination: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('creator_profiles')
    .update({ payout_method: method, payout_destination: destination })
    .eq('user_id', userId)
  if (error) return { ok: false, error: 'Could not save your payout number. Try again.' }
  return { ok: true }
}

export async function getPayoutDestination(userId: string): Promise<{ method: string; destination: string } | null> {
  const { data } = await supabase
    .from('creator_profiles')
    .select('payout_method, payout_destination')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.payout_method || !data?.payout_destination) return null
  return { method: data.payout_method as string, destination: data.payout_destination as string }
}

export interface StorefrontStats {
  earnedThisMonthGhs: number
  liveListings: number
  imports: number
}

// Light stats for the marketplace hero (creators only). Two small queries.
export async function getCreatorStorefrontStats(userId: string): Promise<StorefrontStats> {
  const { data: listingRows } = await supabase
    .from('marketplace_listings')
    .select('id, status, total_purchases')
    .eq('creator_id', userId)

  const listings = listingRows ?? []
  const liveListings = listings.filter(l => l.status === 'approved').length
  const imports = listings.reduce((s, l) => s + Number(l.total_purchases ?? 0), 0)
  const listingIds = listings.map(l => l.id as string)

  let earnedThisMonthGhs = 0
  if (listingIds.length) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { data: purchases } = await supabase
      .from('marketplace_purchases')
      .select('creator_earnings_ghs')
      .in('listing_id', listingIds)
      .eq('payment_status', 'completed')
      .gte('purchased_at', monthStart)
    earnedThisMonthGhs = Math.round((purchases ?? []).reduce((s, p) => s + Number(p.creator_earnings_ghs ?? 0), 0))
  }

  return { earnedThisMonthGhs, liveListings, imports }
}

// Record a payout request for the currently-available balance.
export async function requestPayout(userId: string, amountGhs: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (amountGhs <= 0) return { ok: false, error: 'You have nothing available to pay out yet.' }

  const dest = await getPayoutDestination(userId)
  if (!dest) return { ok: false, error: 'Add your MoMo payout number before requesting a payout.' }

  const { error } = await supabase.from('marketplace_payout_requests').insert({
    creator_id: userId,
    amount_ghs: amountGhs,
    status: 'requested',
    method: dest.method,
    destination: dest.destination,
  })
  if (error) return { ok: false, error: 'Your payout request did not go through. Try again in a moment.' }
  return { ok: true }
}
