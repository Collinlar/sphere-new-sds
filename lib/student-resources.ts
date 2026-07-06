import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { getActiveContext } from './context'
import type { Document, Guide, Note } from './types'

export type StudentResourceType = 'guide' | 'notes' | 'document'

// The institution whose published materials the learner should see:
// the active institution context if set, otherwise the legacy field.
function resolveInstitutionId(): string | null {
  const ctx = getActiveContext()
  if (ctx.type === 'institution') return ctx.institutionId
  return getCurrentUser().institution_id || null
}

export interface StudentResourceItem {
  id: string
  type: StudentResourceType
  title: string
  subject?: string
  grade_level?: string
  cover_color: string
  updated_at: string
}

export async function fetchPublishedResourcesForStudent(): Promise<StudentResourceItem[]> {
  const institutionId = resolveInstitutionId()
  if (!institutionId) return []
  const [guides, notes, documents] = await Promise.all([
    supabase
      .from('guides')
      .select('id, title, subject, grade_level, cover_color, updated_at')
      .eq('institution_id', institutionId)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
    supabase
      .from('notes')
      .select('id, title, subject, grade_level, cover_color, updated_at')
      .eq('institution_id', institutionId)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, subject, grade_level, cover_color, updated_at')
      .eq('institution_id', institutionId)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
  ])

  const items: StudentResourceItem[] = [
    ...(guides.data ?? []).map((g) => ({ ...g, type: 'guide' as const })),
    ...(notes.data ?? []).map((n) => ({ ...n, type: 'notes' as const })),
    ...(documents.data ?? []).map((d) => ({ ...d, type: 'document' as const })),
  ]

  return items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export async function fetchPublishedGuideForStudent(id: string): Promise<Guide | null> {
  const institutionId = resolveInstitutionId()
  const { data } = await supabase
    .from('guides')
    .select('*')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .eq('is_published', true)
    .maybeSingle()
  return (data as Guide | null) ?? null
}

export async function fetchPublishedNoteForStudent(id: string): Promise<Note | null> {
  const institutionId = resolveInstitutionId()
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .eq('is_published', true)
    .maybeSingle()
  return (data as Note | null) ?? null
}

export async function fetchPublishedDocumentForStudent(id: string): Promise<Document | null> {
  const institutionId = resolveInstitutionId()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .eq('is_published', true)
    .maybeSingle()
  return (data as Document | null) ?? null
}
