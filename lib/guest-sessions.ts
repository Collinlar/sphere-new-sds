import { supabase } from './supabase'

const BROWSER_TOKEN_KEY = 'sphere_guest_token'
const PENDING_CLAIMS_KEY = 'sphere_pending_claims'

// Generate a 6-character alphanumeric claim token (no ambiguous chars)
function generateClaimToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Get or create a persistent browser token stored in localStorage.
// This is the "same-browser" auto-claim identifier.
function getBrowserToken(): string {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(BROWSER_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(BROWSER_TOKEN_KEY, token)
  }
  return token
}

// Create a guest session record after a guest completes an exam or engage session.
// Returns the claim token to show on the results page.
export async function createGuestSession(params: {
  sessionType: 'exam' | 'engage'
  resourceSessionId: string
  submissionId: string
  displayName: string
}): Promise<{ claimToken: string } | null> {
  const claimToken = generateClaimToken()
  const browserToken = getBrowserToken()

  const { error } = await supabase.from('guest_sessions').insert({
    session_type: params.sessionType,
    resource_session_id: params.resourceSessionId,
    submission_id: params.submissionId,
    display_name: params.displayName,
    claim_token: claimToken,
    browser_token: browserToken,
  })

  if (error) return null

  // Store pending claim in localStorage so same-browser signup auto-claims
  const pending: string[] = JSON.parse(localStorage.getItem(PENDING_CLAIMS_KEY) ?? '[]')
  pending.push(claimToken)
  localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(pending))

  return { claimToken }
}

// After a user signs up or logs in, auto-claim any guest sessions
// that share the same browser token. Called immediately after auth.
export async function autoClaimBrowserSessions(userId: string): Promise<number> {
  const browserToken = getBrowserToken()
  if (!browserToken) return 0

  const { data, error } = await supabase
    .from('guest_sessions')
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('browser_token', browserToken)
    .is('claimed_by', null)
    .gt('expires_at', new Date().toISOString())
    .select()

  if (error || !data) return 0

  // Clear pending claims from localStorage
  localStorage.removeItem(PENDING_CLAIMS_KEY)

  return data.length
}

// Claim a guest session using the 6-character token (cross-device recovery).
export async function claimByToken(
  claimToken: string,
  userId: string
): Promise<{ ok: boolean; sessionType?: string; submissionId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('guest_sessions')
    .select('*')
    .eq('claim_token', claimToken.toUpperCase())
    .is('claimed_by', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return { ok: false, error: 'That code is not valid or has already been used.' }
  }

  const { error: updateError } = await supabase
    .from('guest_sessions')
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateError) {
    return { ok: false, error: 'Could not claim your session. Try again.' }
  }

  return { ok: true, sessionType: data.session_type, submissionId: data.submission_id }
}

// Fetch all guest sessions claimed by a user (for showing recovered results in profile).
export async function getClaimedSessions(userId: string) {
  const { data } = await supabase
    .from('guest_sessions')
    .select('*')
    .eq('claimed_by', userId)
    .order('created_at', { ascending: false })

  return data ?? []
}
