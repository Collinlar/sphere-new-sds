import { supabase } from './supabase'
import { MARKETPLACE_DEMO_RESOURCES } from './marketplace-seed'
import { normalizeSteps } from './train-paths'

export type MarketplaceResourceType =
  | 'lesson_plan'
  | 'question_bank'
  | 'engage_game'
  | 'train_track'

export type MarketplaceResourceStatus = 'draft' | 'pending_review' | 'published' | 'rejected'

export interface MarketplaceResourceMetadata {
  creator_name?: string
  creator_initials?: string
  verified?: boolean
  featured?: boolean
  accent?: string
  includes?: string[]
  stats?: Record<string, string | number>
  attachments?: string[]
  content?: Record<string, unknown>
}

export interface MarketplaceResource {
  id: string
  creator_id: string | null
  institution_id: string | null
  title: string
  resource_type: MarketplaceResourceType
  subject: string | null
  level: string | null
  description: string | null
  price_ghs: number | null
  status: MarketplaceResourceStatus
  metadata: MarketplaceResourceMetadata
  import_count: number
  rating_avg: number
  rating_count: number
  created_at: string
  updated_at: string
}

export interface MarketplaceReview {
  id: string
  resource_id: string
  user_id: string | null
  rating: number | null
  body: string | null
  created_at: string
}

export type MarketplaceResourceInsert = Omit<
  MarketplaceResource,
  'created_at' | 'updated_at' | 'creator_id' | 'institution_id'
> & {
  id?: string
  creator_id?: string | null
  institution_id?: string | null
}

export interface ResourceFilters {
  search?: string
  type?: MarketplaceResourceType | 'all'
  freeOnly?: boolean
  status?: MarketplaceResourceStatus
  featured?: boolean
}

export interface PublishResourceInput {
  title: string
  resource_type: MarketplaceResourceType
  subject: string
  level: string
  description: string
  price_ghs: number | null
  metadata?: MarketplaceResourceMetadata
  creator_id: string
  institution_id: string
  status?: 'draft' | 'pending_review'
}

const TYPE_LABELS: Record<MarketplaceResourceType, string> = {
  lesson_plan: 'Lesson plan',
  question_bank: 'Question bank',
  engage_game: 'Engage game',
  train_track: 'Train track',
}

export function getResourceTypeLabel(type: MarketplaceResourceType): string {
  return TYPE_LABELS[type] ?? type
}

export function formatPrice(price: number | null): string {
  if (price === null || price === 0) return 'Free'
  return `GH₵ ${price % 1 === 0 ? price : price.toFixed(2)}`
}

export function isFreeResource(resource: Pick<MarketplaceResource, 'price_ghs'>): boolean {
  return resource.price_ghs === null || resource.price_ghs === 0
}

function demoAsResources(): MarketplaceResource[] {
  const now = new Date().toISOString()
  return MARKETPLACE_DEMO_RESOURCES.map((r) => ({
    ...r,
    creator_id: r.creator_id ?? null,
    institution_id: r.institution_id ?? null,
    metadata: (r.metadata ?? {}) as MarketplaceResourceMetadata,
    created_at: now,
    updated_at: now,
  }))
}

function filterDemoResources(filters: ResourceFilters): MarketplaceResource[] {
  let items = demoAsResources()
  if (filters.status) {
    items = items.filter((r) => r.status === filters.status)
  } else {
    items = items.filter((r) => r.status === 'published')
  }
  if (filters.featured) {
    items = items.filter((r) => r.metadata.featured)
  }
  if (filters.type && filters.type !== 'all') {
    items = items.filter((r) => r.resource_type === filters.type)
  }
  if (filters.freeOnly) {
    items = items.filter((r) => isFreeResource(r))
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    items = items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subject?.toLowerCase().includes(q) ?? false) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    )
  }
  return items
}

export async function fetchResources(filters: ResourceFilters = {}): Promise<MarketplaceResource[]> {
  let query = supabase.from('marketplace_resources').select('*')

  if (filters.status) {
    query = query.eq('status', filters.status)
  } else {
    query = query.eq('status', 'published')
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('resource_type', filters.type)
  }

  if (filters.freeOnly) {
    query = query.or('price_ghs.is.null,price_ghs.eq.0')
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error || !data?.length) {
    return filterDemoResources(filters)
  }

  let resources = data as MarketplaceResource[]

  if (filters.featured) {
    resources = resources.filter((r) => r.metadata?.featured)
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    resources = resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subject?.toLowerCase().includes(q) ?? false) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    )
  }

  return resources
}

export async function fetchResourceById(id: string): Promise<MarketplaceResource | null> {
  const { data, error } = await supabase.from('marketplace_resources').select('*').eq('id', id).maybeSingle()
  if (!error && data) return data as MarketplaceResource

  const demo = demoAsResources().find((r) => r.id === id)
  return demo ?? null
}

export async function fetchResourceReviews(resourceId: string): Promise<MarketplaceReview[]> {
  const { data } = await supabase
    .from('marketplace_reviews')
    .select('*')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (data?.length) return data as MarketplaceReview[]

  if (resourceId === 'a1000000-0000-0000-0000-000000000001') {
    return [
      {
        id: 'demo-review-1',
        resource_id: resourceId,
        user_id: null,
        rating: 5,
        body: 'Saved me hours. The Engage games are especially good. Students love them.',
        created_at: new Date().toISOString(),
      },
    ]
  }

  return []
}

export async function hasImported(resourceId: string, institutionId: string): Promise<boolean> {
  const { data } = await supabase
    .from('marketplace_imports')
    .select('id')
    .eq('resource_id', resourceId)
    .eq('institution_id', institutionId)
    .maybeSingle()

  return Boolean(data)
}

export async function importResource(
  resourceId: string,
  userId: string,
  institutionId: string
): Promise<{ ok: true; targetType: string; targetId: string } | { ok: false; error: string }> {
  const resource = await fetchResourceById(resourceId)
  if (!resource) return { ok: false, error: 'That resource is no longer available.' }

  if (!isFreeResource(resource)) {
    return { ok: false, error: 'Paid checkout coming soon. Free resources can be imported now.' }
  }

  const already = await hasImported(resourceId, institutionId)
  if (already) return { ok: false, error: 'Your institution already imported this resource.' }

  const content = (resource.metadata?.content ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  let targetType = ''
  let targetId = ''

  if (resource.resource_type === 'engage_game') {
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: resource.title,
        description: resource.description,
        subject: resource.subject,
        grade_level: resource.level,
        questions: (content.questions as unknown[]) ?? [],
        settings: { imported_from_marketplace: resourceId },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (error || !data) return { ok: false, error: 'Could not copy this quiz into your library.' }
    targetType = 'quiz'
    targetId = data.id as string
  } else if (resource.resource_type === 'lesson_plan') {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: resource.title,
        description: resource.description,
        subject: resource.subject,
        grade_level: resource.level,
        modules: (content.modules as unknown[]) ?? [],
        thumbnail_color: (content.thumbnail_color as string) ?? '#1A8966',
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (error || !data) return { ok: false, error: 'Could not copy this course into your library.' }
    targetType = 'course'
    targetId = data.id as string
  } else if (resource.resource_type === 'train_track') {
    const contentSteps = normalizeSteps((content.steps as unknown[]) ?? [])
    const { data, error } = await supabase
      .from('learning_paths')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: resource.title,
        description: resource.description,
        category: (content.category as string) ?? resource.subject,
        steps: contentSteps,
        is_mandatory: false,
        created_at: now,
      })
      .select('id')
      .single()

    if (error || !data) return { ok: false, error: 'Could not copy this training path into your library.' }
    targetType = 'learning_path'
    targetId = data.id as string
  } else if (resource.resource_type === 'question_bank') {
    const { data, error } = await supabase
      .from('exams')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: resource.title,
        subject: resource.subject,
        grade_level: resource.level,
        duration_minutes: (content.duration_minutes as number) ?? 60,
        questions: (content.questions as unknown[]) ?? [],
        instructions: (content.instructions as string) ?? resource.description,
        settings: { imported_from_marketplace: resourceId },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (error || !data) return { ok: false, error: 'Could not copy this question bank into your library.' }
    targetType = 'exam'
    targetId = data.id as string
  } else {
    return { ok: false, error: 'This resource type cannot be imported yet.' }
  }

  await supabase.from('marketplace_imports').insert({
    resource_id: resourceId,
    institution_id: institutionId,
    imported_by: userId,
  })

  await supabase
    .from('marketplace_resources')
    .update({ import_count: (resource.import_count ?? 0) + 1, updated_at: now })
    .eq('id', resourceId)

  return { ok: true, targetType, targetId }
}

export async function publishResource(input: PublishResourceInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('marketplace_resources')
    .insert({
      creator_id: input.creator_id,
      institution_id: input.institution_id,
      title: input.title.trim(),
      resource_type: input.resource_type,
      subject: input.subject,
      level: input.level,
      description: input.description.trim(),
      price_ghs: input.price_ghs,
      status: input.status ?? 'pending_review',
      metadata: {
        ...input.metadata,
        creator_name: input.metadata?.creator_name,
        creator_initials: input.metadata?.creator_initials,
      },
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Your submission did not go through. Check your connection and try again.' }
  }

  return { ok: true, id: data.id as string }
}

export async function saveResourceDraft(
  input: PublishResourceInput & { id?: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const payload = {
    creator_id: input.creator_id,
    institution_id: input.institution_id,
    title: input.title.trim(),
    resource_type: input.resource_type,
    subject: input.subject,
    level: input.level,
    description: input.description.trim(),
    price_ghs: input.price_ghs,
    status: 'draft' as const,
    metadata: input.metadata ?? {},
    updated_at: now,
  }

  if (input.id) {
    const { error } = await supabase.from('marketplace_resources').update(payload).eq('id', input.id)
    if (error) return { ok: false, error: 'Could not save your draft.' }
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('marketplace_resources')
    .insert({ ...payload, created_at: now })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not save your draft.' }
  return { ok: true, id: data.id as string }
}

export async function fetchPendingResources(): Promise<MarketplaceResource[]> {
  return fetchResources({ status: 'pending_review' })
}

export async function reviewResource(
  resourceId: string,
  action: 'approve' | 'reject',
  reviewerNotes?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = action === 'approve' ? 'published' : 'rejected'
  const existing = await fetchResourceById(resourceId)
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(reviewerNotes ? { reviewer_notes: reviewerNotes } : {}),
  }
  const { error } = await supabase
    .from('marketplace_resources')
    .update({
      status,
      updated_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', resourceId)

  if (error) {
    return { ok: false, error: 'That review action did not save. Try again in a moment.' }
  }

  return { ok: true }
}

export const REVIEW_CHECKLIST = [
  'Content is curriculum-aligned',
  'No copyright violations detected',
  'Quality meets platform standard',
  'Age-appropriate language confirmed',
] as const

export const FILTER_CHIPS: { key: string; label: string; type?: MarketplaceResourceType; freeOnly?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'lesson_plan', label: 'Lesson plans', type: 'lesson_plan' },
  { key: 'question_bank', label: 'Question banks', type: 'question_bank' },
  { key: 'engage_game', label: 'Engage games', type: 'engage_game' },
  { key: 'train_track', label: 'Train tracks', type: 'train_track' },
  { key: 'free', label: 'Free', freeOnly: true },
]

export const RESOURCE_TYPES: { value: MarketplaceResourceType; label: string }[] = [
  { value: 'lesson_plan', label: 'Lesson plan' },
  { value: 'question_bank', label: 'Question bank' },
  { value: 'engage_game', label: 'Engage game' },
  { value: 'train_track', label: 'Train track' },
]

export const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Maths', 'English', 'ICT', 'History', 'Train']
export const LEVELS = ['JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3', 'BECE', 'All staff']
