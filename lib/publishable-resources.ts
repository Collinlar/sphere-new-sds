import { supabase } from './supabase'
import { resolveAuthUserId } from './subscription'
import { getContentInstitutionId } from './context'
import type { PublishableResourceType } from './marketplace-publish'

export type PublishableMode = 'engage' | 'assess' | 'learn' | 'train'

export interface PublishableResourceRow {
  id: string
  title: string
  subject?: string | null
  description?: string | null
  color?: string | null
  mode: PublishableMode
  resourceType: PublishableResourceType
  modeLabel: string
  isListed: boolean
  isReady: boolean
  readyHint?: string
  editHref: string
  createdAt: string
}

export const MODE_META: Record<PublishableMode, { label: string; color: string }> = {
  engage: { label: 'Engage', color: '#D97010' },
  assess: { label: 'Assess', color: '#C23B2A' },
  learn: { label: 'Learn', color: '#1A8966' },
  train: { label: 'Train', color: '#1052A3' },
}

function ownerScopeFilter(userId: string, institutionId: string | null): string {
  if (institutionId) {
    return `creator_id.eq.${userId},institution_id.eq.${institutionId}`
  }
  return `creator_id.eq.${userId}`
}

/** Load resources the creator can list on the marketplace (built in Engage, Assess, Learn, Train). */
export async function fetchPublishableResources(): Promise<PublishableResourceRow[]> {
  const userId = await resolveAuthUserId()
  if (!userId) return []

  const institutionId = getContentInstitutionId()
  const ownerFilter = ownerScopeFilter(userId, institutionId)
  const rows: PublishableResourceRow[] = []

  const [quizzes, exams, guides, notes, documents, courses, paths] = await Promise.all([
    supabase
      .from('quizzes')
      .select('id, title, subject, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('exams')
      .select('id, title, subject, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('guides')
      .select('id, title, subject, description, cover_color, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('notes')
      .select('id, title, subject, cover_color, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, subject, cover_color, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('courses')
      .select('id, title, subject, description, thumbnail_color, is_published, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('learning_paths')
      .select('id, title, description, category, steps, marketplace_listing_id, created_at')
      .or(ownerFilter)
      .order('created_at', { ascending: false }),
  ])

  for (const q of quizzes.data ?? []) {
    rows.push({
      id: q.id,
      title: q.title,
      subject: q.subject,
      mode: 'engage',
      resourceType: 'quiz',
      modeLabel: MODE_META.engage.label,
      isListed: !!q.marketplace_listing_id,
      isReady: !!q.is_published,
      readyHint: 'Publish the quiz in Engage first, then list it here.',
      editHref: `/engage/builder?edit=${q.id}`,
      createdAt: q.created_at,
    })
  }

  for (const e of exams.data ?? []) {
    rows.push({
      id: e.id,
      title: e.title,
      subject: e.subject,
      mode: 'assess',
      resourceType: 'exam',
      modeLabel: MODE_META.assess.label,
      isListed: !!e.marketplace_listing_id,
      isReady: !!e.is_published,
      readyHint: 'Publish the exam in Assess first, then list it here.',
      editHref: '/assess',
      createdAt: e.created_at,
    })
  }

  for (const g of guides.data ?? []) {
    rows.push({
      id: g.id,
      title: g.title,
      subject: g.subject,
      description: g.description,
      color: g.cover_color,
      mode: 'learn',
      resourceType: 'guide',
      modeLabel: 'Guide',
      isListed: !!g.marketplace_listing_id,
      isReady: !!g.is_published,
      readyHint: 'Publish the guide in Learn first, then list it here.',
      editHref: `/learn/guide/builder?edit=${g.id}`,
      createdAt: g.created_at,
    })
  }

  for (const n of notes.data ?? []) {
    rows.push({
      id: n.id,
      title: n.title,
      subject: n.subject,
      color: n.cover_color,
      mode: 'learn',
      resourceType: 'notes',
      modeLabel: 'Notes',
      isListed: !!n.marketplace_listing_id,
      isReady: !!n.is_published,
      readyHint: 'Publish the notes in Learn first, then list it here.',
      editHref: `/learn/notes/builder?edit=${n.id}`,
      createdAt: n.created_at,
    })
  }

  for (const d of documents.data ?? []) {
    rows.push({
      id: d.id,
      title: d.title,
      subject: d.subject,
      color: d.cover_color,
      mode: 'learn',
      resourceType: 'document',
      modeLabel: 'Document',
      isListed: !!d.marketplace_listing_id,
      isReady: !!d.is_published,
      readyHint: 'Publish the document in Learn first, then list it here.',
      editHref: `/learn/documents/builder?edit=${d.id}`,
      createdAt: d.created_at,
    })
  }

  for (const c of courses.data ?? []) {
    rows.push({
      id: c.id,
      title: c.title,
      subject: c.subject,
      description: c.description,
      color: c.thumbnail_color,
      mode: 'learn',
      resourceType: 'course',
      modeLabel: 'Course',
      isListed: !!c.marketplace_listing_id,
      isReady: !!c.is_published,
      readyHint: 'Publish the course in Learn first, then list it here.',
      editHref: `/learn/builder?edit=${c.id}`,
      createdAt: c.created_at,
    })
  }

  for (const p of paths.data ?? []) {
    const stepCount = Array.isArray(p.steps) ? p.steps.length : 0
    rows.push({
      id: p.id,
      title: p.title,
      subject: p.category,
      description: p.description,
      mode: 'train',
      resourceType: 'training_path',
      modeLabel: MODE_META.train.label,
      isListed: !!p.marketplace_listing_id,
      isReady: stepCount > 0,
      readyHint: 'Add at least one step to the training path before listing.',
      editHref: `/train/builder?id=${p.id}`,
      createdAt: p.created_at,
    })
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
