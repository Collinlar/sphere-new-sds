import { supabase } from './supabase'
import { canIssueCertificates } from './subscription'
import { isCertificateIssuingEnabled } from './certificate-permissions'

export type CertResourceType = 'course' | 'exam' | 'training_path'

export interface CertificateAchievement {
  summary: string
  scorePercentage?: number | null
  grade?: string | null
  passMark?: number | null
}

export interface IssueCertificateInput {
  recipientId: string
  issuerId: string | null
  resourceType: CertResourceType
  resourceId: string
  resourceTitle: string
  /** Optional snapshot shown on the public verify page. */
  achievement?: CertificateAchievement
  /** Prefer institution or brand name when known at issue time. */
  issuerDisplayName?: string | null
}

export function examAchievementSummary(opts: {
  percentage: number
  passMark: number
  grade?: string | null
}): string {
  const pct = Math.round(opts.percentage)
  const gradeBit = opts.grade ? `, grade ${opts.grade}` : ''
  return `Passed with ${pct}%${gradeBit} (pass mark ${opts.passMark}%)`
}

export function courseAchievementSummary(): string {
  return 'Completed the full course'
}

export function trainingPathAchievementSummary(): string {
  return 'Completed the training path'
}

export async function resolveIssuerDisplayName(opts: {
  issuerId: string | null
  resourceType: CertResourceType
  resourceId: string
}): Promise<string | null> {
  const table =
    opts.resourceType === 'exam'
      ? 'exams'
      : opts.resourceType === 'course'
        ? 'courses'
        : 'learning_paths'

  const { data: resource } = await supabase
    .from(table)
    .select('institution_id, creator_id')
    .eq('id', opts.resourceId)
    .maybeSingle()

  const institutionId = (resource?.institution_id as string | null) ?? null
  if (institutionId) {
    const { data: inst } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', institutionId)
      .maybeSingle()
    if (inst?.name) return inst.name as string
  }

  const issuerId = opts.issuerId ?? (resource?.creator_id as string | null) ?? null
  if (issuerId) {
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', issuerId)
      .maybeSingle()
    if (user?.name) return user.name as string
  }

  return null
}

// Idempotent: if this recipient already holds a certificate for this resource,
// returns the existing one instead of issuing a duplicate.
export async function issueCertificate(
  input: IssueCertificateInput
): Promise<{ ok: true; verificationCode: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('issued_certificates')
    .select('verification_code')
    .eq('recipient_id', input.recipientId)
    .eq('resource_id', input.resourceId)
    .eq('resource_type', input.resourceType)
    .maybeSingle()

  if (existing?.verification_code) {
    return { ok: true, verificationCode: existing.verification_code as string }
  }

  // Plan gate (issuer must be on a plan that includes certificates) and the
  // Sphere-admin permission flag.
  if (!(await canIssueCertificates())) {
    return { ok: false, error: 'This account plan does not include certificates.' }
  }
  if (input.issuerId && !(await isCertificateIssuingEnabled(input.issuerId))) {
    return { ok: false, error: 'Certificate issuing is disabled for this account.' }
  }

  const issuerDisplayName =
    input.issuerDisplayName?.trim() ||
    (await resolveIssuerDisplayName({
      issuerId: input.issuerId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    }))

  const { data, error } = await supabase
    .from('issued_certificates')
    .insert({
      recipient_id: input.recipientId,
      issuer_id: input.issuerId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      resource_title: input.resourceTitle,
      issued_at: new Date().toISOString(),
      issuer_display_name: issuerDisplayName,
      achievement_summary: input.achievement?.summary ?? null,
      score_percentage: input.achievement?.scorePercentage ?? null,
      grade: input.achievement?.grade ?? null,
      pass_mark: input.achievement?.passMark ?? null,
    })
    .select('verification_code')
    .single()

  if (error || !data) return { ok: false, error: 'Certificate could not be issued.' }
  return { ok: true, verificationCode: data.verification_code as string }
}

export async function getMyCertificate(
  recipientId: string,
  resourceId: string
): Promise<{ verificationCode: string; issuedAt: string; title: string } | null> {
  const { data } = await supabase
    .from('issued_certificates')
    .select('verification_code, issued_at, resource_title')
    .eq('recipient_id', recipientId)
    .eq('resource_id', resourceId)
    .maybeSingle()

  if (!data) return null
  return {
    verificationCode: data.verification_code as string,
    issuedAt: data.issued_at as string,
    title: data.resource_title as string,
  }
}

// The active custom template for an owner (institution or creator), if any.
export async function getActiveTemplate(ownerId: string): Promise<{ id: string; fileUrl: string | null } | null> {
  const { data } = await supabase
    .from('certificate_templates')
    .select('id, file_url')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (!data) return null
  return { id: data.id as string, fileUrl: data.file_url as string | null }
}
