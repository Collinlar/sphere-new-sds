'use client'

import { supabase } from './supabase'
import { USER_WITH_INSTITUTION_NAME_MODULES } from './supabase-embeds'
import type { SubscriptionTier } from './types'

export interface SphereUser {
  id: string
  name: string
  email: string
  role: string
  institution_id: string | null
  avatar_initials: string
  subscription_tier?: SubscriptionTier
}

const FALLBACK_USER: SphereUser = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Ama Owusu',
  email: 'ama@kumasijhs.edu.gh',
  role: 'teacher',
  institution_id: '00000000-0000-0000-0000-000000000001',
  avatar_initials: 'AO',
}

export const SPHERE_PLAN_CHANGE_EVENT = 'sphere-plan-change'

export function getCurrentUser(): SphereUser {
  if (typeof window === 'undefined') return FALLBACK_USER
  try {
    const raw = localStorage.getItem('sphere_user')
    if (!raw) return FALLBACK_USER
    return JSON.parse(raw) as SphereUser
  } catch {
    return FALLBACK_USER
  }
}

/** Cached user id when session is unavailable (never the demo fallback id). */
export function getCachedUserId(): string | null {
  const user = getCurrentUser()
  if (!user.id || user.id === FALLBACK_USER.id) return null
  return user.id
}

export function notifyPlanChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SPHERE_PLAN_CHANGE_EVENT))
}

/** Re-fetch the user profile from Supabase and refresh localStorage. */
export async function refreshUserProfile(userId?: string): Promise<SphereUser | null> {
  let uid = userId
  if (!uid) {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id
  }
  if (!uid) return null

  const { data: userRecord } = await supabase
    .from('users')
    .select(USER_WITH_INSTITUTION_NAME_MODULES)
    .eq('id', uid)
    .maybeSingle()

  if (!userRecord) return null

  localStorage.setItem('sphere_user', JSON.stringify(userRecord))
  if (userRecord.institutions?.name) {
    localStorage.setItem('sphere_institution', userRecord.institutions.name)
  }
  notifyPlanChange()
  return userRecord as SphereUser
}
