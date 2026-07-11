import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { getPlatformSetting } from './platform-settings'

// Institution verification. Functional use is never blocked; only
// brand-facing powers (custom-branded certificates, public presence) wait
// for a 'verified' status. Trusted institutional email domains auto-verify;
// everything else goes to admin review.

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

// Free consumer providers can never auto-verify — anyone can hold one.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com',
])

// Built-in institutional patterns (Ghana-first): educational and government
// domains. Additional trusted domains can be added in platform_settings under
// 'trusted_verification_domains' (comma-separated).
function matchesBuiltinInstitutionDomain(domain: string): boolean {
  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.edu.gh') ||
    domain.endsWith('.gov.gh') ||
    /\.ac\.[a-z]{2}$/.test(domain) ||      // .ac.uk, .ac.gh, ...
    /\.edu\.[a-z]{2}$/.test(domain)        // .edu.gh, .edu.ng, ...
  )
}

export const TRUSTED_DOMAINS_KEY = 'trusted_verification_domains'

// Does this email belong to a domain we trust enough to auto-verify?
export async function isTrustedInstitutionEmail(email: string | null | undefined): Promise<boolean> {
  const domain = (email ?? '').trim().toLowerCase().split('@')[1]
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return false
  if (matchesBuiltinInstitutionDomain(domain)) return true

  const configured = await getPlatformSetting(TRUSTED_DOMAINS_KEY, '')
  const list = configured.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
  return list.some(d => domain === d || domain.endsWith('.' + d))
}

export interface InstitutionVerification {
  status: VerificationStatus
  note: string | null
  verifiedAt: string | null
}

export async function getInstitutionVerification(institutionId: string): Promise<InstitutionVerification> {
  const { data } = await supabase
    .from('institutions')
    .select('verification_status, verification_note, verified_at')
    .eq('id', institutionId)
    .maybeSingle()
  return {
    status: (data?.verification_status as VerificationStatus) ?? 'unverified',
    note: (data?.verification_note as string) ?? null,
    verifiedAt: (data?.verified_at as string) ?? null,
  }
}

export async function isInstitutionVerified(institutionId: string): Promise<boolean> {
  const v = await getInstitutionVerification(institutionId)
  return v.status === 'verified'
}

// Owner submits their institution for review. If their email is on a trusted
// institutional domain, it's verified immediately; otherwise it goes pending.
// Returns the resulting status so the UI can reflect an instant verification.
export async function requestInstitutionVerification(
  institutionId: string
): Promise<{ ok: boolean; status?: VerificationStatus }> {
  const trusted = await isTrustedInstitutionEmail(getCurrentUser().email)
  const nextStatus: VerificationStatus = trusted ? 'verified' : 'pending'

  const { error } = await supabase
    .from('institutions')
    .update({
      verification_status: nextStatus,
      verified_at: trusted ? new Date().toISOString() : null,
      verification_note: trusted ? 'Auto-verified by institutional email domain' : null,
    })
    .eq('id', institutionId)
    .in('verification_status', ['unverified', 'rejected'])

  if (error) return { ok: false }
  return { ok: true, status: nextStatus }
}

// Admin decision.
export async function adminSetInstitutionVerification(
  institutionId: string,
  status: Extract<VerificationStatus, 'verified' | 'rejected' | 'unverified'>,
  note?: string
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('institutions')
    .update({
      verification_status: status,
      verification_note: note ?? null,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
    })
    .eq('id', institutionId)
  return { ok: !error }
}
