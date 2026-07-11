import { supabase } from './supabase'

// SphereSDS-assisted content creation: creators request help building a
// resource, or Sphere proactively offers. Commission is negotiated per deal
// (agreed_commission_rate) and applied to the resulting listing, where the
// purchase fulfilment already honours listing.commission_rate.

export type AssistStatus = 'requested' | 'quoted' | 'in_progress' | 'delivered' | 'declined'

export interface AssistRequest {
  id: string
  creatorId: string
  creatorName: string
  creatorEmail: string
  initiatedBy: 'creator' | 'sphere'
  brief: string | null
  status: AssistStatus
  agreedCommissionRate: number | null
  listingId: string | null
  adminNote: string | null
  createdAt: string
}

export async function createAssistRequest(creatorId: string, brief: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!brief.trim()) return { ok: false, error: 'Tell us what you want built first.' }
  const { error } = await supabase.from('assist_requests').insert({
    creator_id: creatorId,
    initiated_by: 'creator',
    brief: brief.trim(),
    status: 'requested',
  })
  if (error) return { ok: false, error: 'Your request did not go through. Try again in a moment.' }
  return { ok: true }
}

// The creator's own requests, newest first.
export async function getMyAssistRequests(creatorId: string): Promise<Pick<AssistRequest, 'id' | 'brief' | 'status' | 'agreedCommissionRate' | 'createdAt'>[]> {
  const { data } = await supabase
    .from('assist_requests')
    .select('id, brief, status, agreed_commission_rate, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(5)

  return (data ?? []).map(r => ({
    id: r.id as string,
    brief: (r.brief as string) ?? null,
    status: r.status as AssistStatus,
    agreedCommissionRate: r.agreed_commission_rate != null ? Number(r.agreed_commission_rate) : null,
    createdAt: r.created_at as string,
  }))
}

// ── Admin ──

export async function adminGetAssistRequests(): Promise<AssistRequest[]> {
  const { data } = await supabase
    .from('assist_requests')
    .select('id, creator_id, initiated_by, brief, status, agreed_commission_rate, listing_id, admin_note, created_at, users(name, email)')
    .order('created_at', { ascending: false })

  return (data ?? []).map(r => {
    const u = (r as unknown as { users?: { name: string; email: string } }).users
    return {
      id: r.id as string,
      creatorId: r.creator_id as string,
      creatorName: u?.name ?? 'Creator',
      creatorEmail: u?.email ?? '',
      initiatedBy: (r.initiated_by as 'creator' | 'sphere') ?? 'creator',
      brief: (r.brief as string) ?? null,
      status: r.status as AssistStatus,
      agreedCommissionRate: r.agreed_commission_rate != null ? Number(r.agreed_commission_rate) : null,
      listingId: (r.listing_id as string) ?? null,
      adminNote: (r.admin_note as string) ?? null,
      createdAt: r.created_at as string,
    }
  })
}

// Sphere proactively offering assistance to a creator.
export async function adminCreateAssistOffer(creatorId: string, note: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('assist_requests').insert({
    creator_id: creatorId,
    initiated_by: 'sphere',
    brief: note.trim() || null,
    status: 'quoted',
  })
  return { ok: !error }
}

export async function adminUpdateAssistRequest(
  id: string,
  patch: { status?: AssistStatus; agreedCommissionRate?: number | null; adminNote?: string; listingId?: string | null }
): Promise<{ ok: boolean }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status) row.status = patch.status
  if (patch.agreedCommissionRate !== undefined) row.agreed_commission_rate = patch.agreedCommissionRate
  if (patch.adminNote !== undefined) row.admin_note = patch.adminNote
  if (patch.listingId !== undefined) row.listing_id = patch.listingId

  const { error } = await supabase.from('assist_requests').update(row).eq('id', id)

  // When a listing is linked and a rate agreed, stamp the rate onto the
  // listing so purchase fulfilment uses the negotiated split.
  if (!error && patch.listingId && patch.agreedCommissionRate != null) {
    await supabase
      .from('marketplace_listings')
      .update({ commission_rate: patch.agreedCommissionRate })
      .eq('id', patch.listingId)
  }

  return { ok: !error }
}
