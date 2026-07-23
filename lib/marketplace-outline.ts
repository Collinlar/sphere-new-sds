import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin'
import { resolveCatalogPayload } from './marketplace-catalog'
import { normalizeSteps } from './train-paths'

export interface ListingOutlineItem {
  title: string
  meta?: string
}

export interface ListingOutline {
  resourceType: string
  summary: string
  stats: { label: string; value: string }[]
  items: ListingOutlineItem[]
  staffNotes?: string[]
}

type AnyRow = Record<string, unknown>

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function buildQuizOutline(row: AnyRow, staff: boolean): ListingOutline {
  const questions = asArray<{ text?: string; type?: string; options?: unknown[]; points?: number }>(row.questions)
  return {
    resourceType: 'quiz',
    summary: `${questions.length} live questions ready to host as an Engage game.`,
    stats: [
      { label: 'Questions', value: String(questions.length) },
      { label: 'Subject', value: String(row.subject ?? 'General') },
    ],
    items: questions.slice(0, staff ? 40 : 12).map((q, i) => ({
      title: staff ? (q.text?.trim() || `Question ${i + 1}`) : `Question ${i + 1}`,
      meta: [q.type, q.options?.length ? `${q.options.length} options` : null, q.points != null ? `${q.points} pts` : null]
        .filter(Boolean)
        .join(' · '),
    })),
    staffNotes: staff ? ['Answer keys are hidden in this preview.'] : undefined,
  }
}

function buildCourseOutline(row: AnyRow): ListingOutline {
  const modules = asArray<{ title?: string; type?: string; duration_minutes?: number }>(row.modules)
  const minutes = modules.reduce((s, m) => s + Number(m.duration_minutes ?? 0), 0)
  return {
    resourceType: 'course',
    summary: `${modules.length} modules covering the full learning path.`,
    stats: [
      { label: 'Modules', value: String(modules.length) },
      { label: 'Est. time', value: minutes > 0 ? `${minutes} min` : '—' },
    ],
    items: modules.map((m, i) => ({
      title: m.title?.trim() || `Module ${i + 1}`,
      meta: [m.type, m.duration_minutes ? `${m.duration_minutes} min` : null].filter(Boolean).join(' · '),
    })),
  }
}

function buildPathOutline(row: AnyRow): ListingOutline {
  const steps = normalizeSteps(row.steps)
  const minutes = steps.reduce((s, st) => s + Number(st.duration_minutes ?? 0), 0)
  return {
    resourceType: 'training_path',
    summary: `${steps.length} training steps with progress tracking and completion.`,
    stats: [
      { label: 'Steps', value: String(steps.length) },
      { label: 'Category', value: String(row.category ?? 'Training') },
      { label: 'Est. time', value: minutes > 0 ? `${minutes} min` : '—' },
    ],
    items: steps.map((st, i) => ({
      title: st.title?.trim() || `Step ${i + 1}`,
      meta: [st.type, st.duration_minutes ? `${st.duration_minutes} min` : null, st.is_mandatory ? 'Required' : 'Optional']
        .filter(Boolean)
        .join(' · '),
    })),
  }
}

function buildExamOutline(row: AnyRow, staff: boolean): ListingOutline {
  const questions = asArray<{ text?: string; type?: string; marks?: number }>(row.questions)
  const marks = questions.reduce((s, q) => s + Number(q.marks ?? 0), 0)
  const byType: Record<string, number> = {}
  for (const q of questions) byType[q.type ?? 'question'] = (byType[q.type ?? 'question'] ?? 0) + 1

  return {
    resourceType: 'exam',
    summary: `Timed assessment with ${questions.length} questions${marks ? ` worth ${marks} marks` : ''}.`,
    stats: [
      { label: 'Questions', value: String(questions.length) },
      { label: 'Duration', value: row.duration_minutes ? `${row.duration_minutes} min` : '—' },
      { label: 'Total marks', value: marks ? String(marks) : '—' },
    ],
    items: [
      ...Object.entries(byType).map(([type, count]) => ({
        title: `${count} ${type.replace('_', ' ')} question${count === 1 ? '' : 's'}`,
      })),
      ...(staff
        ? questions.slice(0, 20).map((q, i) => ({
            title: q.text?.trim() || `Question ${i + 1}`,
            meta: [q.type, q.marks != null ? `${q.marks} marks` : null].filter(Boolean).join(' · '),
          }))
        : []),
    ],
    staffNotes: staff ? ['Correct answers are hidden from this preview.'] : undefined,
  }
}

function buildGuideOutline(row: AnyRow, staff: boolean): ListingOutline {
  const steps = asArray<{ title?: string; body?: string; tip?: string }>(row.steps)
  return {
    resourceType: 'guide',
    summary: `${steps.length} guided reading steps.`,
    stats: [
      { label: 'Steps', value: String(steps.length) },
      { label: 'Est. time', value: row.estimated_minutes ? `${row.estimated_minutes} min` : '—' },
    ],
    items: steps.map((s, i) => ({
      title: s.title?.trim() || `Step ${i + 1}`,
      meta: staff && s.body ? `${String(s.body).slice(0, 80)}${String(s.body).length > 80 ? '…' : ''}` : undefined,
    })),
  }
}

function buildNotesOutline(row: AnyRow): ListingOutline {
  const blocks = asArray<{ type?: string; content?: { text?: string } }>(row.blocks)
  const headings = blocks.filter((b) => b.type === 'heading').map((b) => b.content?.text?.trim()).filter(Boolean) as string[]
  return {
    resourceType: 'notes',
    summary: `${blocks.length} content blocks${row.is_downloadable ? ', downloadable for offline use' : ''}.`,
    stats: [
      { label: 'Blocks', value: String(blocks.length) },
      { label: 'Download', value: row.is_downloadable ? 'Yes' : 'In-app' },
    ],
    items: (headings.length ? headings : blocks.slice(0, 8).map((_, i) => `Section ${i + 1}`)).map((title) => ({ title })),
  }
}

function buildDocumentOutline(row: AnyRow): ListingOutline {
  const content = (row.content ?? {}) as { sections?: { heading?: string }[]; blocks?: { text?: string }[] }
  const sections = content.sections ?? []
  return {
    resourceType: 'document',
    summary: row.content_type === 'upload'
      ? `Uploaded file${row.file_name ? `: ${row.file_name}` : ''}.`
      : `${sections.length || 'Structured'} document sections.`,
    stats: [
      { label: 'Type', value: String(row.content_type ?? 'document') },
      ...(row.file_name ? [{ label: 'File', value: String(row.file_name) }] : []),
    ],
    items: sections.length
      ? sections.map((s, i) => ({ title: s.heading?.trim() || `Section ${i + 1}` }))
      : [{ title: row.title ? String(row.title) : 'Document' }],
  }
}

async function loadBackingRow(
  admin: SupabaseClient,
  resourceType: string,
  resourceId: string,
): Promise<AnyRow | null> {
  const table =
    resourceType === 'quiz' ? 'quizzes'
      : resourceType === 'course' ? 'courses'
        : resourceType === 'training_path' ? 'learning_paths'
          : resourceType === 'exam' ? 'exams'
            : resourceType === 'guide' ? 'guides'
              : resourceType === 'notes' ? 'notes'
                : resourceType === 'document' ? 'documents'
                  : null

  if (table) {
    const { data } = await admin.from(table).select('*').eq('id', resourceId).maybeSingle()
    if (data) return data as AnyRow
  }

  const catalog = await resolveCatalogPayload(resourceId)
  if (catalog?.content && typeof catalog.content === 'object') {
    const content = catalog.content as AnyRow
    return {
      ...content,
      subject: catalog.subject,
      title: content.title ?? catalog.description,
    }
  }

  const { data: resource } = await admin.from('marketplace_resources').select('*').eq('id', resourceId).maybeSingle()
  if (resource?.metadata && typeof resource.metadata === 'object') {
    const meta = resource.metadata as AnyRow
    const content = (meta.content as AnyRow | undefined) ?? meta
    return { ...content, subject: resource.subject, title: resource.title }
  }

  return null
}

export function buildOutlineFromRow(resourceType: string, row: AnyRow, staff: boolean): ListingOutline {
  switch (resourceType) {
    case 'quiz':
      return buildQuizOutline(row, staff)
    case 'course':
      return buildCourseOutline(row)
    case 'training_path':
      return buildPathOutline(row)
    case 'exam':
      return buildExamOutline(row, staff)
    case 'guide':
      return buildGuideOutline(row, staff)
    case 'notes':
      return buildNotesOutline(row)
    case 'document':
      return buildDocumentOutline(row)
    default:
      return {
        resourceType,
        summary: 'Content preview is not available for this resource type yet.',
        stats: [],
        items: [],
      }
  }
}

export async function getListingOutline(listingId: string, staff: boolean): Promise<ListingOutline | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data: listing } = await admin
    .from('marketplace_listings')
    .select('id, resource_type, resource_id, status, title, description')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return null
  if (listing.status !== 'approved' && !staff) return null

  const row = await loadBackingRow(admin, listing.resource_type, listing.resource_id)
  if (!row) {
    return {
      resourceType: listing.resource_type,
      summary: listing.description?.trim() || 'No structured outline is attached to this listing yet.',
      stats: [],
      items: [],
      staffNotes: staff ? ['Backing content row could not be loaded. Check resource_id.'] : undefined,
    }
  }

  return buildOutlineFromRow(listing.resource_type, row, staff)
}
