import { supabase } from './supabase'
import { normalizeSteps } from './train-paths'
import type {
  MarketplaceResource,
  MarketplaceResourceMetadata,
  MarketplaceResourceStatus,
  MarketplaceResourceType,
  PublishResourceInput,
} from './marketplace'

/** Teacher platform types → schema v2 listing resource_type */
export const TEACHER_TO_LISTING_TYPE: Record<MarketplaceResourceType, string> = {
  lesson_plan: 'course',
  question_bank: 'exam',
  engage_game: 'quiz',
  train_track: 'training_path',
}

/** Schema v2 listing resource_type → teacher platform types */
export const LISTING_TO_TEACHER_TYPE: Record<string, MarketplaceResourceType> = {
  course: 'lesson_plan',
  exam: 'question_bank',
  quiz: 'engage_game',
  training_path: 'train_track',
  guide: 'lesson_plan',
  notes: 'lesson_plan',
  document: 'lesson_plan',
}

export interface MarketplaceListingRow {
  id: string
  creator_id: string | null
  title: string
  description: string | null
  resource_type: string
  resource_id: string
  price_ghs: number | null
  is_free: boolean
  subject: string | null
  target_levels: string[] | null
  status: string
  thumbnail_color: string | null
  total_purchases: number | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export function listingStatusToResource(status: string): MarketplaceResourceStatus {
  if (status === 'approved') return 'published'
  if (status === 'pending_review' || status === 'draft' || status === 'rejected') {
    return status as MarketplaceResourceStatus
  }
  return 'draft'
}

export function resourceStatusToListing(status: MarketplaceResourceStatus): string {
  if (status === 'published') return 'approved'
  return status
}

export function listingToResource(
  listing: MarketplaceListingRow,
  extras?: {
    institution_id?: string | null
    metadata?: MarketplaceResourceMetadata
    import_count?: number
  }
): MarketplaceResource {
  const teacherType =
    LISTING_TO_TEACHER_TYPE[listing.resource_type] ?? ('lesson_plan' as MarketplaceResourceType)

  return {
    id: listing.id,
    creator_id: listing.creator_id,
    institution_id: extras?.institution_id ?? null,
    title: listing.title,
    resource_type: teacherType,
    subject: listing.subject,
    level: listing.target_levels?.[0] ?? null,
    description: listing.description,
    price_ghs: listing.is_free ? null : listing.price_ghs,
    status: listingStatusToResource(listing.status),
    metadata: {
      ...(extras?.metadata ?? {}),
      listing_id: listing.id,
      backing_resource_id: listing.resource_id,
      backing_resource_type: listing.resource_type,
      accent: listing.thumbnail_color ?? undefined,
    },
    import_count: extras?.import_count ?? listing.total_purchases ?? 0,
    rating_avg: 0,
    rating_count: 0,
    created_at: listing.created_at,
    updated_at: listing.updated_at,
  }
}

export async function createBackingResource(
  input: PublishResourceInput
): Promise<{ ok: true; resourceId: string; listingType: string } | { ok: false; error: string }> {
  const listingType = TEACHER_TO_LISTING_TYPE[input.resource_type]
  const content = (input.metadata?.content ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  if (listingType === 'quiz') {
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        institution_id: input.institution_id,
        creator_id: input.creator_id,
        title: input.title.trim(),
        description: input.description.trim(),
        subject: input.subject,
        grade_level: input.level,
        questions: (content.questions as unknown[]) ?? [],
        settings: { marketplace_source: true },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not prepare this quiz for listing.' }
    return { ok: true, resourceId: data.id as string, listingType }
  }

  if (listingType === 'course') {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        institution_id: input.institution_id,
        creator_id: input.creator_id,
        title: input.title.trim(),
        description: input.description.trim(),
        subject: input.subject,
        grade_level: input.level,
        modules: (content.modules as unknown[]) ?? [],
        thumbnail_color: (content.thumbnail_color as string) ?? '#1A8966',
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not prepare this course for listing.' }
    return { ok: true, resourceId: data.id as string, listingType }
  }

  if (listingType === 'training_path') {
    const { data, error } = await supabase
      .from('learning_paths')
      .insert({
        institution_id: input.institution_id,
        creator_id: input.creator_id,
        title: input.title.trim(),
        description: input.description.trim(),
        category: (content.category as string) ?? input.subject,
        steps: normalizeSteps((content.steps as unknown[]) ?? []),
        is_mandatory: false,
        created_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not prepare this training path for listing.' }
    return { ok: true, resourceId: data.id as string, listingType }
  }

  if (listingType === 'exam') {
    const { data, error } = await supabase
      .from('exams')
      .insert({
        institution_id: input.institution_id,
        creator_id: input.creator_id,
        title: input.title.trim(),
        subject: input.subject,
        grade_level: input.level,
        duration_minutes: (content.duration_minutes as number) ?? 60,
        questions: (content.questions as unknown[]) ?? [],
        instructions: (content.instructions as string) ?? input.description.trim(),
        settings: { marketplace_source: true },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not prepare this exam for listing.' }
    return { ok: true, resourceId: data.id as string, listingType }
  }

  return { ok: false, error: 'This resource type cannot be listed yet.' }
}

export async function insertListing(
  input: PublishResourceInput,
  backing: { resourceId: string; listingType: string },
  status: 'draft' | 'pending_review'
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const price = input.price_ghs ?? 0
  const isFree = input.price_ghs === null || input.price_ghs === 0

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      creator_id: input.creator_id,
      title: input.title.trim(),
      description: input.description.trim(),
      resource_type: backing.listingType,
      resource_id: backing.resourceId,
      price_ghs: price,
      is_free: isFree,
      subject: input.subject,
      target_levels: [input.level],
      status,
      thumbnail_color: '#1A8966',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Your listing did not save. Check your connection and try again.' }
  }

  return { ok: true, listingId: data.id as string }
}

export async function importFromListing(
  listing: MarketplaceListingRow,
  userId: string,
  institutionId: string
): Promise<{ ok: true; targetType: string; targetId: string } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const resourceId = listing.resource_id
  const listingType = listing.resource_type

  if (listingType === 'quiz') {
    const { data: source, error: fetchErr } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle()
    if (fetchErr || !source) return { ok: false, error: 'Could not load this quiz for import.' }

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: listing.title,
        description: listing.description ?? source.description,
        subject: listing.subject ?? source.subject,
        grade_level: listing.target_levels?.[0] ?? source.grade_level,
        questions: source.questions ?? [],
        settings: { imported_from_listing: listing.id },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not copy this quiz into your library.' }
    return { ok: true, targetType: 'quiz', targetId: data.id as string }
  }

  if (listingType === 'course') {
    const { data: source, error: fetchErr } = await supabase
      .from('courses')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle()
    if (fetchErr || !source) return { ok: false, error: 'Could not load this course for import.' }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: listing.title,
        description: listing.description ?? source.description,
        subject: listing.subject ?? source.subject,
        grade_level: listing.target_levels?.[0] ?? source.grade_level,
        modules: source.modules ?? [],
        thumbnail_color: source.thumbnail_color ?? '#1A8966',
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not copy this course into your library.' }
    return { ok: true, targetType: 'course', targetId: data.id as string }
  }

  if (listingType === 'training_path') {
    const { data: source, error: fetchErr } = await supabase
      .from('learning_paths')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle()
    if (fetchErr || !source) return { ok: false, error: 'Could not load this training path for import.' }

    const { data, error } = await supabase
      .from('learning_paths')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: listing.title,
        description: listing.description ?? source.description,
        category: source.category ?? listing.subject,
        steps: normalizeSteps(source.steps ?? []),
        is_mandatory: false,
        created_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not copy this training path into your library.' }
    return { ok: true, targetType: 'learning_path', targetId: data.id as string }
  }

  if (listingType === 'exam') {
    const { data: source, error: fetchErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', resourceId)
      .maybeSingle()
    if (fetchErr || !source) return { ok: false, error: 'Could not load this exam for import.' }

    const { data, error } = await supabase
      .from('exams')
      .insert({
        institution_id: institutionId,
        creator_id: userId,
        title: listing.title,
        subject: listing.subject ?? source.subject,
        grade_level: listing.target_levels?.[0] ?? source.grade_level,
        duration_minutes: source.duration_minutes ?? 60,
        questions: source.questions ?? [],
        instructions: source.instructions ?? listing.description,
        settings: { imported_from_listing: listing.id },
        is_published: false,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not copy this exam into your library.' }
    return { ok: true, targetType: 'exam', targetId: data.id as string }
  }

  return { ok: false, error: 'This listing type cannot be imported yet.' }
}
