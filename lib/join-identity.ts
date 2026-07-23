import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export interface JoinIdentity {
  signedIn: boolean
  userId: string | null
  accountName: string
}

/** Resolve logged-in identity for Engage / Assess join screens. */
export async function resolveJoinIdentity(): Promise<JoinIdentity> {
  const cached = getCurrentUser()
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user?.id ?? null

  if (!uid) {
    return { signedIn: false, userId: null, accountName: '' }
  }

  let accountName = cached?.id === uid ? (cached.name ?? '') : ''
  if (!accountName) {
    const { data: row } = await supabase.from('users').select('name').eq('id', uid).maybeSingle()
    accountName = (row?.name as string | undefined)?.trim() || data.session?.user?.email?.split('@')[0] || 'Player'
  }

  return { signedIn: true, userId: uid, accountName }
}
