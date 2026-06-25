'use client'

export interface SphereUser {
  id: string
  name: string
  email: string
  role: string
  institution_id: string
  avatar_initials: string
}

const FALLBACK_USER: SphereUser = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Ama Owusu',
  email: 'ama@kumasijhs.edu.gh',
  role: 'teacher',
  institution_id: '00000000-0000-0000-0000-000000000001',
  avatar_initials: 'AO',
}

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
