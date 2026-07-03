import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Document, Guide, Note } from './types'

export async function fetchGuides(institutionId: string): Promise<Guide[]> {
  const { data } = await supabase
    .from('guides')
    .select('*')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as Guide[]
}

export async function fetchNotes(institutionId: string): Promise<Note[]> {
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as Note[]
}

export async function fetchDocuments(institutionId: string): Promise<Document[]> {
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as Document[]
}

export async function createGuide(input: {
  title: string
  description?: string
  subject?: string
  grade_level?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = getCurrentUser()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('guides')
    .insert({
      creator_id: user.id,
      institution_id: user.institution_id,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      subject: input.subject ?? null,
      grade_level: input.grade_level ?? null,
      cover_color: '#1052A3',
      steps: [],
      is_published: false,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not create your guide. Try again.' }
  return { ok: true, id: data.id as string }
}

export async function createNote(input: {
  title: string
  subject?: string
  grade_level?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = getCurrentUser()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('notes')
    .insert({
      creator_id: user.id,
      institution_id: user.institution_id,
      title: input.title.trim(),
      subject: input.subject ?? null,
      grade_level: input.grade_level ?? null,
      cover_color: '#2E2886',
      blocks: [],
      is_published: false,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not create your notes pack. Try again.' }
  return { ok: true, id: data.id as string }
}

export async function createDocument(input: {
  title: string
  subject?: string
  grade_level?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = getCurrentUser()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('documents')
    .insert({
      creator_id: user.id,
      institution_id: user.institution_id,
      title: input.title.trim(),
      subject: input.subject ?? null,
      grade_level: input.grade_level ?? null,
      cover_color: '#D97010',
      content_type: 'editor',
      content: { blocks: [] },
      is_published: false,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not create your document. Try again.' }
  return { ok: true, id: data.id as string }
}

export async function deleteContentResource(
  table: 'quizzes' | 'exams' | 'courses' | 'learning_paths' | 'guides' | 'notes' | 'documents',
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not remove that item. Try again.' }
  return { ok: true }
}

export async function fetchGuideById(id: string): Promise<Guide | null> {
  const { data } = await supabase.from('guides').select('*').eq('id', id).maybeSingle()
  return (data as Guide | null) ?? null
}

export async function fetchNoteById(id: string): Promise<Note | null> {
  const { data } = await supabase.from('notes').select('*').eq('id', id).maybeSingle()
  return (data as Note | null) ?? null
}

export async function fetchDocumentById(id: string): Promise<Document | null> {
  const { data } = await supabase.from('documents').select('*').eq('id', id).maybeSingle()
  return (data as Document | null) ?? null
}

export async function updateGuide(
  id: string,
  payload: Partial<Pick<Guide, 'title' | 'description' | 'steps' | 'subject' | 'grade_level' | 'is_published' | 'estimated_minutes'>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('guides')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: 'Could not save your guide.' }
  return { ok: true }
}

export async function updateNote(
  id: string,
  payload: Partial<Pick<Note, 'title' | 'blocks' | 'subject' | 'grade_level' | 'is_published' | 'is_downloadable'>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('notes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: 'Could not save your notes.' }
  return { ok: true }
}

export async function updateDocument(
  id: string,
  payload: Partial<Pick<Document, 'title' | 'content' | 'subject' | 'grade_level' | 'is_published'>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('documents')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: 'Could not save your document.' }
  return { ok: true }
}

const BUILDER_ROUTES: Record<string, string> = {
  guides: '/platform/guides/builder',
  notes: '/platform/notes/builder',
  documents: '/platform/documents/builder',
}

export function getContentBuilderHref(tab: string, id: string): string | null {
  const base = BUILDER_ROUTES[tab]
  return base ? `${base}?id=${id}` : null
}
