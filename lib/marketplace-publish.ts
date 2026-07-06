import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import { assertMarketplacePublish } from './plan-privileges'

// Institution types a listing can be targeted at (mirrors institution_types
// seed data in schema_v2.sql). Used for level-based marketplace matching.
export const TARGET_LEVEL_TYPES: { id: string; label: string }[] = [
  { id: 'jhs', label: 'Junior High School' },
  { id: 'shs', label: 'Senior High School' },
  { id: 'primary', label: 'Primary School' },
  { id: 'university', label: 'University' },
  { id: 'college', label: 'Polytechnic / College' },
  { id: 'training', label: 'Training Institution' },
  { id: 'corporate', label: 'Corporate / Company' },
  { id: 'professional', label: 'Professional Body' },
]

export type PublishableResourceType = 'guide' | 'notes' | 'document' | 'course' | 'exam' | 'quiz' | 'training_path'

export interface PublishExistingInput {
  resourceType: PublishableResourceType
  resourceId: string
  title: string
  description?: string | null
  subject?: string | null
  thumbnailColor?: string | null
  priceGhs: number | null
  isEntryResource: boolean
  targetLevelTypes: string[]
}

// Publish a resource the creator already built (guide, note, document, course,
// exam, quiz, training path) by pointing a marketplace_listings row at it.
// No duplication of content — the listing just references the existing row.
export async function publishExistingResource(
  input: PublishExistingInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const gate = await assertMarketplacePublish()
  if (!gate.ok) return gate

  const user = getCurrentUser()

  if (input.isEntryResource) {
    const { data: existingEntry } = await supabase
      .from('marketplace_listings')
      .select('id')
      .eq('creator_id', user.id)
      .eq('is_entry_resource', true)
      .neq('resource_id', input.resourceId)
      .maybeSingle()

    if (existingEntry) {
      return { ok: false, error: 'You already have a free showcase resource. Unpublish it first, or uncheck this option.' }
    }
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      creator_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      price_ghs: input.isEntryResource ? 0 : (input.priceGhs ?? 0),
      is_free: input.isEntryResource || !input.priceGhs || input.priceGhs === 0,
      is_entry_resource: input.isEntryResource,
      target_level_types: input.targetLevelTypes.length ? input.targetLevelTypes : null,
      subject: input.subject?.trim() || null,
      thumbnail_color: input.thumbnailColor ?? '#1A8966',
      status: 'pending_review',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Your listing did not save. Check your connection and try again.' }
  }

  // Link the listing back onto the source content row so it shows
  // "On marketplace" in the creator's library.
  const table = { guide: 'guides', notes: 'notes', document: 'documents', course: 'courses', exam: 'exams', quiz: 'quizzes', training_path: 'learning_paths' }[input.resourceType]
  await supabase.from(table).update({ marketplace_listing_id: data.id }).eq('id', input.resourceId)

  return { ok: true, id: data.id }
}

// Fetch the existing listing (if any) for a piece of content, so the
// publish modal can show "already listed" state instead of duplicating.
export async function getListingForResource(resourceId: string): Promise<{ id: string; status: string } | null> {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('id, status')
    .eq('resource_id', resourceId)
    .maybeSingle()
  return data ?? null
}

export async function unpublishListing(listingId: string, resourceId: string, resourceType: PublishableResourceType): Promise<void> {
  await supabase.from('marketplace_listings').delete().eq('id', listingId)
  const table = { guide: 'guides', notes: 'notes', document: 'documents', course: 'courses', exam: 'exams', quiz: 'quizzes', training_path: 'learning_paths' }[resourceType]
  await supabase.from(table).update({ marketplace_listing_id: null }).eq('id', resourceId)
}
