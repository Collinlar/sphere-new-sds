'use client'

import { supabase } from '@/lib/supabase'

// =====================================================
// Active context: the lens through which the user works.
// 'personal'    — their own account, personal quota
// 'institution' — inside an institution, acting as their member_role
// =====================================================

export type MemberRole = 'owner' | 'admin' | 'teacher' | 'student'

export interface Membership {
  id: string
  institution_id: string
  institution_name: string
  institution_type_id: string | null
  member_role: MemberRole
  status: 'invited' | 'active' | 'removed'
}

export type ActiveContext =
  | { type: 'personal' }
  | { type: 'institution'; institutionId: string; institutionName: string; memberRole: MemberRole }

const CONTEXT_KEY = 'sphere_active_context'
const MEMBERSHIPS_KEY = 'sphere_memberships'

// ---------- context read/write ----------

export function getActiveContext(): ActiveContext {
  if (typeof window === 'undefined') return { type: 'personal' }
  try {
    const raw = localStorage.getItem(CONTEXT_KEY)
    if (!raw) return { type: 'personal' }
    const parsed = JSON.parse(raw) as ActiveContext
    if (parsed.type === 'institution' && parsed.institutionId) return parsed
    return { type: 'personal' }
  } catch {
    return { type: 'personal' }
  }
}

export function setActiveContext(ctx: ActiveContext) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx))
  // Notify listeners in this tab (storage events only fire cross-tab)
  window.dispatchEvent(new CustomEvent('sphere-context-change', { detail: ctx }))
}

export function onContextChange(handler: (ctx: ActiveContext) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => handler((e as CustomEvent).detail as ActiveContext)
  window.addEventListener('sphere-context-change', listener)
  return () => window.removeEventListener('sphere-context-change', listener)
}

// ---------- memberships ----------

// Fetch active + invited memberships for a user, cache locally,
// and validate that the stored active context is still legitimate.
export async function loadMemberships(userId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from('institution_members')
    .select('id, institution_id, member_role, status, institutions(name, institution_type_id)')
    .eq('user_id', userId)
    .neq('status', 'removed')

  const memberships: Membership[] = (data ?? []).map(row => {
    const inst = (row as unknown as { institutions?: { name: string; institution_type_id: string | null } }).institutions
    return {
      id: row.id,
      institution_id: row.institution_id,
      institution_name: inst?.name ?? 'Institution',
      institution_type_id: inst?.institution_type_id ?? null,
      member_role: row.member_role as MemberRole,
      status: row.status as Membership['status'],
    }
  })

  if (typeof window !== 'undefined') {
    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships))

    // If the saved context points at an institution the user no longer
    // belongs to, fall back to personal.
    const ctx = getActiveContext()
    if (ctx.type === 'institution') {
      const stillMember = memberships.some(
        m => m.institution_id === ctx.institutionId && m.status === 'active'
      )
      if (!stillMember) setActiveContext({ type: 'personal' })
    }
  }

  return memberships
}

export function getCachedMemberships(): Membership[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MEMBERSHIPS_KEY)
    return raw ? (JSON.parse(raw) as Membership[]) : []
  } catch {
    return []
  }
}

export function clearContextState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CONTEXT_KEY)
  localStorage.removeItem(MEMBERSHIPS_KEY)
}

// ---------- invitations ----------

// Attach any pending invites (matched by email) to a user account.
// Called after login/signup. Returns the number of invites attached.
export async function attachPendingInvites(userId: string, email: string): Promise<number> {
  if (!email) return 0
  const { data: invites } = await supabase
    .from('institution_members')
    .select('id')
    .eq('status', 'invited')
    .is('user_id', null)
    .ilike('invited_email', email)

  if (!invites || invites.length === 0) return 0

  await supabase
    .from('institution_members')
    .update({ user_id: userId })
    .in('id', invites.map(i => i.id))

  return invites.length
}

// Accept an invited membership (turns invited -> active)
export async function acceptMembership(membershipId: string) {
  await supabase
    .from('institution_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', membershipId)
}

// Decline an invited membership
export async function declineMembership(membershipId: string) {
  await supabase
    .from('institution_members')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('id', membershipId)
}

// Claim a membership by 6-char code (for no-email roster invites)
export async function claimMembershipByCode(code: string, userId: string): Promise<Membership | null> {
  const { data: row } = await supabase
    .from('institution_members')
    .select('id, institution_id, member_role, status, institutions(name, institution_type_id)')
    .eq('claim_code', code.toUpperCase())
    .eq('status', 'invited')
    .maybeSingle()

  if (!row) return null

  await supabase
    .from('institution_members')
    .update({ user_id: userId, status: 'active', joined_at: new Date().toISOString() })
    .eq('id', row.id)

  const inst = (row as unknown as { institutions?: { name: string; institution_type_id: string | null } }).institutions
  return {
    id: row.id,
    institution_id: row.institution_id,
    institution_name: inst?.name ?? 'Institution',
    institution_type_id: inst?.institution_type_id ?? null,
    member_role: row.member_role as MemberRole,
    status: 'active',
  }
}

// The institution_id to stamp on newly created content.
// Institution context -> that institution owns the content (it stays if the
// creator leaves). Personal context -> null, content belongs to the user.
export function getContentInstitutionId(): string | null {
  const ctx = getActiveContext()
  return ctx.type === 'institution' ? ctx.institutionId : null
}

// ---------- role helpers ----------

export function canManagePlatform(ctx: ActiveContext): boolean {
  return ctx.type === 'institution' && (ctx.memberRole === 'owner' || ctx.memberRole === 'admin')
}

export function canCreateContent(ctx: ActiveContext): boolean {
  // Personal context: everyone can create (quota-gated, not role-gated).
  // Institution context: owners, admins and teachers create; students do not.
  if (ctx.type === 'personal') return true
  return ctx.memberRole !== 'student'
}

// Labels adapt to institution type: corporate sees Employees/HR language.
export function memberLabels(institutionTypeId: string | null): { student: string; students: string; teacher: string; teachers: string } {
  if (institutionTypeId === 'corporate') {
    return { student: 'Employee', students: 'Employees', teacher: 'Trainer', teachers: 'Trainers' }
  }
  return { student: 'Student', students: 'Students', teacher: 'Teacher', teachers: 'Teachers' }
}
