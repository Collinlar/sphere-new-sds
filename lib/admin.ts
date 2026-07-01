import { supabase } from './supabase'

export async function adminGetStats() {
  const [
    { count: totalInstitutions },
    { count: totalUsers },
    { count: totalMembers },
    { count: pendingCreators },
    { count: pendingListings },
    { count: guestUnclaimed },
    { data: recentSignups },
  ] = await Promise.all([
    supabase.from('institutions').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'membership'),
    supabase.from('creator_profiles').select('id', { count: 'exact', head: true }).eq('is_approved', false).is('rejected_at', null),
    supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('guest_sessions').select('id', { count: 'exact', head: true }).is('claimed_by', null).lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
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
    signupsThisWeek,
    signupsLastWeek,
  }
}

export async function adminGetMarketplaceRevenue() {
  const { data } = await supabase
    .from('marketplace_purchases')
    .select('amount_ghs, created_at, sphere_commission_ghs')
    .order('created_at', { ascending: false })
    .limit(500)

  const purchases = data ?? []
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const thisMonth = purchases.filter(p => p.created_at >= monthAgo)

  return {
    revenueThisMonth: thisMonth.reduce((s, p) => s + (p.sphere_commission_ghs ?? 0), 0),
    salesThisMonth: thisMonth.length,
    totalRevenue: purchases.reduce((s, p) => s + (p.sphere_commission_ghs ?? 0), 0),
  }
}
