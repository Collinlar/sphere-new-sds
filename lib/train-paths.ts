import { supabase } from '@/lib/supabase'
import type { LearningPath, PathStep } from '@/lib/types'

export type TrainStepType = PathStep['type']

export function defaultStepContent(type: TrainStepType): Record<string, unknown> {
  switch (type) {
    case 'video':
      return { youtube_id: '', body: 'Watch the full video before marking this step complete.' }
    case 'reading':
      return {
        body: '',
        key_principle: '',
        quick_check: { text: '', options: ['', '', ''], correct: 0 },
      }
    case 'quiz':
      return {
        questions: [{ text: '', options: ['', ''] }],
      }
    case 'sign_off':
      return { policy_text: 'I confirm I have read and understood this policy.' }
    case 'assessment':
      return { prompt: 'Describe what you learned and how you will apply it in your role.' }
    default:
      return {}
  }
}

export function normalizeSteps(raw: unknown): PathStep[] {
  if (!Array.isArray(raw)) return []
  return raw.map((step, index) => {
    const s = step as Partial<PathStep>
    const type = (s.type ?? 'reading') as TrainStepType
    return {
      id: s.id ?? `st-${index + 1}`,
      title: s.title ?? `Step ${index + 1}`,
      type,
        content: sanitizeStepContent(type, s.content && Object.keys(s.content).length > 0 ? s.content : defaultStepContent(type)),
      duration_minutes: s.duration_minutes ?? 10,
      is_mandatory: s.is_mandatory ?? true,
    }
  })
}

export function extractYoutubeId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? trimmed
}

export function sanitizeStepContent(type: TrainStepType, content: Record<string, unknown>): Record<string, unknown> {
  if (type === 'video') {
    return { ...content, youtube_id: extractYoutubeId(String(content.youtube_id ?? '')) }
  }
  return content
}

export function stepHasContent(step: PathStep): boolean {
  const c = step.content ?? {}
  switch (step.type) {
    case 'video':
      return Boolean((c.youtube_id as string)?.trim())
    case 'reading':
      return Boolean((c.body as string)?.trim())
    case 'quiz':
      return Array.isArray(c.questions) && (c.questions as { text?: string }[]).some(q => q.text?.trim())
    case 'sign_off':
      return Boolean((c.policy_text as string)?.trim())
    case 'assessment':
      return Boolean((c.prompt as string)?.trim())
    default:
      return false
  }
}

export interface PathStats {
  assigned: number
  avgCompletion: number
  certificates: number
}

export async function fetchPathStats(pathIds: string[]): Promise<Record<string, PathStats>> {
  if (pathIds.length === 0) return {}

  const { data } = await supabase
    .from('path_enrollments')
    .select('path_id, progress_percentage, certificate_issued_at')
    .in('path_id', pathIds)

  const stats: Record<string, PathStats> = {}
  for (const id of pathIds) {
    stats[id] = { assigned: 0, avgCompletion: 0, certificates: 0 }
  }

  if (!data) return stats

  const grouped = new Map<string, typeof data>()
  for (const row of data) {
    const list = grouped.get(row.path_id) ?? []
    list.push(row)
    grouped.set(row.path_id, list)
  }

  for (const [pathId, rows] of grouped) {
    const assigned = rows.length
    const avgCompletion = assigned > 0
      ? Math.round(rows.reduce((sum, r) => sum + (r.progress_percentage ?? 0), 0) / assigned)
      : 0
    const certificates = rows.filter(r => r.certificate_issued_at).length
    stats[pathId] = { assigned, avgCompletion, certificates }
  }

  return stats
}

export async function syncPathEnrollments(
  pathId: string,
  institutionId: string,
  departments: string[],
): Promise<number> {
  const roles = ['employee', 'teacher', 'hr', 'admin']
  const { data: users } = await supabase
    .from('users')
    .select('id, department, role')
    .eq('institution_id', institutionId)
    .in('role', roles)

  if (!users?.length) return 0

  const allStaff = departments.includes('All staff')
  const eligible = allStaff
    ? users
    : users.filter(u => u.department && departments.includes(u.department))

  if (eligible.length === 0) return 0

  const rows = eligible.map(u => ({
    path_id: pathId,
    employee_id: u.id,
    progress_percentage: 0,
    completed_steps: [],
  }))

  await supabase
    .from('path_enrollments')
    .upsert(rows, { onConflict: 'path_id,employee_id', ignoreDuplicates: true })

  await supabase
    .from('learning_paths')
    .update({ assigned_count: eligible.length, updated_at: new Date().toISOString() })
    .eq('id', pathId)

  return eligible.length
}

/** Issue a completion certificate when the institution plan allows it. */
export async function issuePathCertificate(
  pathId: string,
  employeeId: string
): Promise<{ ok: true; verificationCode?: string } | { ok: false; error: string }> {
  const { canIssueCertificates } = await import('./subscription')
  if (!(await canIssueCertificates())) {
    return {
      ok: false,
      error: 'Your institution plan does not include certificates. Upgrade to Creator or Institution.',
    }
  }

  const { data: path } = await supabase
    .from('learning_paths')
    .select('id, title, creator_id, institution_id')
    .eq('id', pathId)
    .single()

  if (!path) {
    return { ok: false, error: 'Training path not found.' }
  }

  const { isCertificateIssuingEnabled } = await import('./certificate-permissions')
  if (path.creator_id && !(await isCertificateIssuingEnabled(path.creator_id))) {
    return { ok: false, error: 'Certificate issuing is disabled for this account.' }
  }

  const { error } = await supabase
    .from('path_enrollments')
    .update({
      certificate_issued_at: new Date().toISOString(),
      progress_percentage: 100,
    })
    .eq('path_id', pathId)
    .eq('employee_id', employeeId)

  if (error) {
    return { ok: false, error: 'Certificate could not be issued. Try again.' }
  }

  const { data: issued, error: certError } = await supabase
    .from('issued_certificates')
    .insert({
      recipient_id: employeeId,
      issuer_id: path.creator_id,
      resource_type: 'training_path',
      resource_id: pathId,
      resource_title: path.title,
      issued_at: new Date().toISOString(),
    })
    .select('verification_code')
    .single()

  if (certError) {
    return { ok: true }
  }

  return { ok: true, verificationCode: issued?.verification_code as string | undefined }
}

export function parseAssignedDepartments(path: LearningPath & { assigned_departments?: string[] }): string[] {
  if (Array.isArray(path.assigned_departments) && path.assigned_departments.length > 0) {
    return path.assigned_departments
  }
  return ['All staff']
}
