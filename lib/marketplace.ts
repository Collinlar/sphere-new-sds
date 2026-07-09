import { supabase } from './supabase'
import { MARKETPLACE_DEMO_RESOURCES } from './marketplace-seed'
import { enrichMetadataWithCatalog, resolveCatalogPayload } from './marketplace-catalog'
import {
  createBackingResource,
  importFromListing,
  insertListing,
  listingToResource,
  resourceStatusToListing,
  type MarketplaceListingRow,
} from './marketplace-bridge'
import { assertMarketplacePublish } from './plan-privileges'
import { normalizeSteps } from './train-paths'
import { getCurrentUser } from './auth'
import { getActiveContext } from './context'
import {
  destinationInstitutionId,
  type ImportDestination,
  moduleForListingType,
  moduleForResourceType,
  getImportDestinations,
} from './library-scope'
import type { ModuleKey } from './institution-modules'

// Maps a signup-time level_type + user_level onto the institution_types
// vocabulary used for marketplace targeting (jhs, shs, primary, university,
// college, training, corporate, professional).
function levelTypeFromPersonalProfile(levelType: string | null, userLevel: string | null): string | null {
  if (levelType === 'university_student') return 'university'
  if (levelType === 'professional') return 'professional'
  if (levelType === 'educator' || levelType === 'school_student') {
    const lvl = userLevel ?? ''
    if (lvl.startsWith('p')) return 'primary'
    if (lvl.startsWith('jhs') || lvl === 'teach_jhs') return 'jhs'
    if (lvl.startsWith('shs') || lvl === 'teach_shs') return 'shs'
    if (lvl === 'teach_primary') return 'primary'
  }
  return null
}

// Which institution_types level the current viewer should be matched against,
// so the marketplace can prioritise resources built for their level. Returns
// null when there is nothing to match on — untargeted browsing sees everything.
export async function getViewerLevelType(): Promise<string | null> {
  const ctx = getActiveContext()

  if (ctx.type === 'institution') {
    const { data } = await supabase
      .from('institutions')
      .select('institution_type_id')
      .eq('id', ctx.institutionId)
      .maybeSingle()
    return data?.institution_type_id ?? null
  }

  const user = getCurrentUser()
  const { data } = await supabase
    .from('users')
    .select('level_type, user_level')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null
  return levelTypeFromPersonalProfile(data.level_type ?? null, data.user_level ?? null)
}

export type MarketplaceResourceType =
  | 'lesson_plan'
  | 'question_bank'
  | 'engage_game'
  | 'train_track'
  | 'reading_material'

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
  listing_id?: string
  backing_resource_id?: string
  backing_resource_type?: string
  reviewer_notes?: string
  target_level_types?: string[]
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
  // Soft filter: when set, resources targeted at other levels are pushed
  // down (not hidden) so the viewer sees what suits them first. Untargeted
  // listings (no target_level_types set) always rank as suitable for everyone.
  viewerLevelType?: string | null
}

function matchesViewerLevel(resource: MarketplaceResource, viewerLevelType?: string | null): boolean {
  if (!viewerLevelType) return true
  const targets = resource.metadata?.target_level_types
  if (!targets || targets.length === 0) return true
  return targets.includes(viewerLevelType)
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
  institution_id: string | null
  status?: 'draft' | 'pending_review'
}

const TYPE_LABELS: Record<MarketplaceResourceType, string> = {
  lesson_plan: 'Lesson plan',
  question_bank: 'Question bank',
  engage_game: 'Engage game',
  train_track: 'Train track',
  reading_material: 'Reading material',
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

function filterResources(resources: MarketplaceResource[], filters: ResourceFilters): MarketplaceResource[] {
  let items = resources

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

async function fetchListings(filters: ResourceFilters): Promise<MarketplaceResource[]> {
  let query = supabase.from('marketplace_listings').select('*')

  if (filters.status) {
    query = query.eq('status', resourceStatusToListing(filters.status))
  } else {
    query = query.eq('status', 'approved')
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error || !data?.length) return []

  let resources = (data as MarketplaceListingRow[]).map((row) => listingToResource(row))

  if (filters.type && filters.type !== 'all') {
    resources = resources.filter((r) => r.resource_type === filters.type)
  }

  if (filters.freeOnly) {
    resources = resources.filter((r) => isFreeResource(r))
  }

  return filterResources(resources, { ...filters, status: filters.status, type: 'all', freeOnly: false })
}

async function fetchLegacyResources(filters: ResourceFilters): Promise<MarketplaceResource[]> {
  let query = supabase.from('marketplace_resources').select('*').is('listing_id', null)

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
  if (error || !data?.length) return []

  return filterResources(data as MarketplaceResource[], { ...filters, type: 'all', freeOnly: false })
}

export async function fetchResources(filters: ResourceFilters = {}): Promise<MarketplaceResource[]> {
  const [fromListings, fromLegacy] = await Promise.all([fetchListings(filters), fetchLegacyResources(filters)])
  let merged = [...fromListings, ...fromLegacy].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (!merged.length) merged = filterDemoResources(filters)

  if (filters.viewerLevelType) {
    // Level-matched resources first, then everything else, each in recency order.
    const matched = merged.filter((r) => matchesViewerLevel(r, filters.viewerLevelType))
    const rest = merged.filter((r) => !matchesViewerLevel(r, filters.viewerLevelType))
    return [...matched, ...rest]
  }

  return merged
}

async function fetchListingById(id: string): Promise<MarketplaceResource | null> {
  const { data, error } = await supabase.from('marketplace_listings').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return listingToResource(data as MarketplaceListingRow)
}

export async function fetchResourceById(id: string): Promise<MarketplaceResource | null> {
  const listing = await fetchListingById(id)
  if (listing) return listing

  const { data, error } = await supabase.from('marketplace_resources').select('*').eq('id', id).maybeSingle()
  if (!error && data) {
    const row = data as MarketplaceResource
    return {
      ...row,
      metadata: enrichMetadataWithCatalog(id, row.metadata as Record<string, unknown>) as MarketplaceResourceMetadata,
    }
  }

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

function importScopeQuery(
  destination: ImportDestination,
  userId: string
) {
  const institutionId = destinationInstitutionId(destination)
  if (institutionId) {
    return { institutionId, importedBy: null as string | null }
  }
  return { institutionId: null, importedBy: userId }
}

export async function hasImported(
  resourceId: string,
  destination: ImportDestination,
  userId?: string
): Promise<boolean> {
  const uid = userId ?? getCurrentUser().id
  const { institutionId, importedBy } = importScopeQuery(destination, uid)

  let listingQuery = supabase
    .from('marketplace_imports')
    .select('id')
    .eq('listing_id', resourceId)

  listingQuery = institutionId
    ? listingQuery.eq('institution_id', institutionId)
    : listingQuery.is('institution_id', null).eq('imported_by', importedBy!)

  const { data: byListing } = await listingQuery.maybeSingle()
  if (byListing) return true

  let resourceQuery = supabase
    .from('marketplace_imports')
    .select('id')
    .eq('resource_id', resourceId)

  resourceQuery = institutionId
    ? resourceQuery.eq('institution_id', institutionId)
    : resourceQuery.is('institution_id', null).eq('imported_by', importedBy!)

  const { data } = await resourceQuery.maybeSingle()
  return Boolean(data)
}

export async function fetchImportedListingIds(
  destination: ImportDestination,
  userId?: string
): Promise<Set<string>> {
  const uid = userId ?? getCurrentUser().id
  const { institutionId, importedBy } = importScopeQuery(destination, uid)

  let query = supabase
    .from('marketplace_imports')
    .select('listing_id, resource_id')

  query = institutionId
    ? query.eq('institution_id', institutionId)
    : query.is('institution_id', null).eq('imported_by', importedBy!)

  const { data } = await query
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.listing_id) ids.add(row.listing_id as string)
    if (row.resource_id) ids.add(row.resource_id as string)
  }
  return ids
}

export async function fetchAllImportedResourceIds(userId?: string): Promise<Set<string>> {
  const uid = userId ?? getCurrentUser().id
  const destinations = getImportDestinations()
  const allIds = new Set<string>()
  for (const dest of destinations) {
    const ids = await fetchImportedListingIds(dest, uid)
    ids.forEach((id) => allIds.add(id))
  }
  return allIds
}

export async function hasImportedAnywhere(resourceId: string, userId?: string): Promise<boolean> {
  const uid = userId ?? getCurrentUser().id
  const destinations = getImportDestinations()
  for (const dest of destinations) {
    if (await hasImported(resourceId, dest, uid)) return true
  }
  return false
}

export async function findImportedDestinations(
  resourceId: string,
  userId?: string
): Promise<ImportDestination[]> {
  const uid = userId ?? getCurrentUser().id
  const destinations = getImportDestinations()
  const found: ImportDestination[] = []
  for (const dest of destinations) {
    if (await hasImported(resourceId, dest, uid)) found.push(dest)
  }
  return found
}

const TARGET_TABLE: Record<string, string> = {
  quiz: 'quizzes',
  course: 'courses',
  learning_path: 'learning_paths',
  exam: 'exams',
}

const LISTING_COPY_TABLE: Record<string, string> = {
  quiz: 'quizzes',
  course: 'courses',
  training_path: 'learning_paths',
  exam: 'exams',
}

async function importCopyExists(
  listing: MarketplaceListingRow,
  institutionId: string | null,
  userId: string
): Promise<boolean> {
  const table = LISTING_COPY_TABLE[listing.resource_type]
  if (!table) return false

  let query = supabase.from(table).select('id').eq('marketplace_listing_id', listing.id)
  if (institutionId) {
    query = query.eq('institution_id', institutionId)
  } else {
    query = query.is('institution_id', null).eq('creator_id', userId)
  }

  const { data } = await query.maybeSingle()
  return Boolean(data)
}

async function clearOrphanImportRecord(
  resourceId: string,
  destination: ImportDestination,
  userId: string
): Promise<void> {
  const { institutionId, importedBy } = importScopeQuery(destination, userId)

  let query = supabase.from('marketplace_imports').delete().or(`listing_id.eq.${resourceId},resource_id.eq.${resourceId}`)
  query = institutionId
    ? query.eq('institution_id', institutionId)
    : query.is('institution_id', null).eq('imported_by', importedBy!)

  await query
}

async function recordMarketplaceImport(params: {
  listingId?: string
  resourceId?: string
  institutionId: string | null
  userId: string
  targetType?: string
  targetId?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {
    institution_id: params.institutionId,
    imported_by: params.userId,
  }
  if (params.listingId) row.listing_id = params.listingId
  if (params.resourceId) row.resource_id = params.resourceId

  const { error } = await supabase.from('marketplace_imports').insert(row)
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('marketplace_imports insert failed:', error.code, error.message)
    }
    if (params.targetType && params.targetId) {
      const table = TARGET_TABLE[params.targetType]
      if (table) await supabase.from(table).delete().eq('id', params.targetId)
    }
    if (error.code === '23505') {
      return { ok: false, error: 'This resource is already in that library.' }
    }
    return { ok: false, error: 'We could not register this in your library. Try again in a moment.' }
  }
  return { ok: true }
}

export function moduleForMarketplaceResource(resource: Pick<MarketplaceResource, 'resource_type'>): ModuleKey {
  return moduleForResourceType(resource.resource_type)
}

export function moduleForMarketplaceListingType(listingType: string): ModuleKey {
  return moduleForListingType(listingType)
}

export async function importResource(
  resourceId: string,
  userId: string,
  destination: ImportDestination
): Promise<{ ok: true; targetType: string; targetId: string } | { ok: false; error: string }> {
  const institutionId = destinationInstitutionId(destination)
  const { data: listingRow } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', resourceId)
    .maybeSingle()

  if (listingRow) {
    const listing = listingRow as MarketplaceListingRow
    if (!listing.is_free && (listing.price_ghs ?? 0) > 0) {
      return { ok: false, error: 'This is a paid resource. Use Buy with MoMo to add it to your library.' }
    }

    const already = await hasImported(resourceId, destination, userId)
    if (already) {
      const hasCopy = await importCopyExists(listing, institutionId, userId)
      if (hasCopy) return { ok: false, error: 'This resource is already in that library.' }
      await clearOrphanImportRecord(resourceId, destination, userId)
    }

    const copied = await importFromListing(listing, userId, institutionId)
    if (!copied.ok) return copied

    const recorded = await recordMarketplaceImport({
      listingId: listing.id,
      resourceId: listing.resource_id,
      institutionId,
      userId,
      targetType: copied.targetType,
      targetId: copied.targetId,
    })
    if (!recorded.ok) return recorded

    const now = new Date().toISOString()
    await supabase
      .from('marketplace_listings')
      .update({
        total_purchases: (listing.total_purchases ?? 0) + 1,
        updated_at: now,
      })
      .eq('id', listing.id)

    return copied
  }

  const resource = await fetchResourceById(resourceId)
  if (!resource) return { ok: false, error: 'That resource is no longer available.' }

  if (!isFreeResource(resource)) {
    return { ok: false, error: 'This is a paid resource. Use Buy with MoMo to add it to your library.' }
  }

  const already = await hasImported(resourceId, destination, userId)
  if (already) return { ok: false, error: 'This resource is already in that library.' }

  const backingResourceId =
    (resource.metadata?.backing_resource_id as string | undefined) ?? resourceId
  let content = (resource.metadata?.content ?? {}) as Record<string, unknown>
  if (Object.keys(content).length === 0) {
    const catalog = await resolveCatalogPayload(backingResourceId)
    if (catalog) content = catalog.content
  }
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
    const { data: linkedListing } = await supabase
      .from('marketplace_listings')
      .select('id')
      .eq('resource_id', resourceId)
      .maybeSingle()

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
        marketplace_listing_id: linkedListing?.id ?? null,
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

  const recorded = await recordMarketplaceImport({
    resourceId,
    institutionId,
    userId,
    targetType,
    targetId,
  })
  if (!recorded.ok) return recorded

  await supabase
    .from('marketplace_resources')
    .update({ import_count: (resource.import_count ?? 0) + 1, updated_at: now })
    .eq('id', resourceId)

  return { ok: true, targetType, targetId }
}

export async function publishResource(input: PublishResourceInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const gate = await assertMarketplacePublish()
  if (!gate.ok) return gate

  const listingStatus = input.status === 'draft' ? 'draft' : 'pending_review'
  const backing = await createBackingResource(input)
  if (!backing.ok) return backing

  const listing = await insertListing(input, backing, listingStatus)
  if (!listing.ok) return listing

  const now = new Date().toISOString()
  const { error } = await supabase.from('marketplace_resources').insert({
    creator_id: input.creator_id,
    institution_id: input.institution_id,
    title: input.title.trim(),
    resource_type: input.resource_type,
    subject: input.subject,
    level: input.level,
    description: input.description.trim(),
    price_ghs: input.price_ghs,
    status: input.status ?? 'pending_review',
    listing_id: listing.listingId,
    metadata: {
      ...input.metadata,
      listing_id: listing.listingId,
      backing_resource_id: backing.resourceId,
      backing_resource_type: backing.listingType,
      creator_name: input.metadata?.creator_name,
      creator_initials: input.metadata?.creator_initials,
    },
    created_at: now,
    updated_at: now,
  })

  if (error) {
    await supabase.from('marketplace_listings').delete().eq('id', listing.listingId)
    return { ok: false, error: 'Your submission did not go through. Check your connection and try again.' }
  }

  return { ok: true, id: listing.listingId }
}

export async function saveResourceDraft(
  input: PublishResourceInput & { id?: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const gate = await assertMarketplacePublish()
  if (!gate.ok) return gate

  const now = new Date().toISOString()

  if (input.id) {
    const existing = await fetchResourceById(input.id)
    const listingId = existing?.metadata?.listing_id ?? input.id

    const { error: listingErr } = await supabase
      .from('marketplace_listings')
      .update({
        title: input.title.trim(),
        description: input.description.trim(),
        subject: input.subject,
        target_levels: [input.level],
        price_ghs: input.price_ghs ?? 0,
        is_free: input.price_ghs === null || input.price_ghs === 0,
        status: 'draft',
        updated_at: now,
      })
      .eq('id', listingId)

    if (listingErr) return { ok: false, error: 'Could not save your draft.' }

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
      listing_id: listingId,
      metadata: { ...(input.metadata ?? {}), listing_id: listingId },
      updated_at: now,
    }

    if (existing && existing.metadata?.listing_id) {
      const { error } = await supabase
        .from('marketplace_resources')
        .update(payload)
        .eq('listing_id', listingId)
      if (error) return { ok: false, error: 'Could not save your draft.' }
    } else {
      await supabase.from('marketplace_resources').insert({ ...payload, created_at: now })
    }

    return { ok: true, id: listingId }
  }

  const backing = await createBackingResource(input)
  if (!backing.ok) return backing

  const listing = await insertListing(input, backing, 'draft')
  if (!listing.ok) return listing

  const { error } = await supabase.from('marketplace_resources').insert({
    creator_id: input.creator_id,
    institution_id: input.institution_id,
    title: input.title.trim(),
    resource_type: input.resource_type,
    subject: input.subject,
    level: input.level,
    description: input.description.trim(),
    price_ghs: input.price_ghs,
    status: 'draft',
    listing_id: listing.listingId,
    metadata: { ...(input.metadata ?? {}), listing_id: listing.listingId },
    created_at: now,
    updated_at: now,
  })

  if (error) return { ok: false, error: 'Could not save your draft.' }
  return { ok: true, id: listing.listingId }
}

export async function fetchPendingResources(): Promise<MarketplaceResource[]> {
  const [listings, legacy] = await Promise.all([
    fetchResources({ status: 'pending_review' }),
    supabase
      .from('marketplace_resources')
      .select('*')
      .eq('status', 'pending_review')
      .is('listing_id', null)
      .order('created_at', { ascending: false }),
  ])

  const legacyRows = (legacy.data ?? []) as MarketplaceResource[]
  const listingIds = new Set(listings.map((l) => l.id))
  const extraLegacy = legacyRows.filter((r) => !listingIds.has(r.id))

  return [...listings, ...extraLegacy].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export async function reviewResource(
  resourceId: string,
  action: 'approve' | 'reject',
  reviewerNotes?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { canReviewMarketplace } = await import('./plan-privileges')
  if (!(await canReviewMarketplace())) {
    return { ok: false, error: 'Only Sphere staff can review marketplace submissions.' }
  }

  const listingStatus = action === 'approve' ? 'approved' : 'rejected'
  const resourceStatus = action === 'approve' ? 'published' : 'rejected'
  const now = new Date().toISOString()

  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', resourceId)
    .maybeSingle()

  if (listing) {
    const { error: listingErr } = await supabase
      .from('marketplace_listings')
      .update({
        status: listingStatus,
        approved_at: action === 'approve' ? now : null,
        admin_notes: reviewerNotes ?? null,
        updated_at: now,
      })
      .eq('id', resourceId)

    if (listingErr) {
      return { ok: false, error: 'That review action did not save. Try again in a moment.' }
    }

    const { data: linkedResource } = await supabase
      .from('marketplace_resources')
      .select('metadata')
      .eq('listing_id', resourceId)
      .maybeSingle()

    const linkedMetadata = (linkedResource?.metadata ?? {}) as MarketplaceResourceMetadata

    await supabase
      .from('marketplace_resources')
      .update({
        status: resourceStatus,
        updated_at: now,
        metadata: {
          ...linkedMetadata,
          ...(reviewerNotes ? { reviewer_notes: reviewerNotes } : {}),
        },
      })
      .eq('listing_id', resourceId)

    return { ok: true }
  }

  const existing = await fetchResourceById(resourceId)
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(reviewerNotes ? { reviewer_notes: reviewerNotes } : {}),
  }
  const { error } = await supabase
    .from('marketplace_resources')
    .update({
      status: resourceStatus,
      updated_at: now,
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
