'use client'

import { getCurrentUser } from './auth'
import { getActiveContext, getCachedMemberships } from './context'
import type { ModuleKey } from './institution-modules'
import type { MarketplaceResourceType } from './marketplace'
import { supabase } from './supabase'

export type ImportDestination =
  | { kind: 'personal' }
  | { kind: 'institution'; institutionId: string; institutionName?: string }

export interface LibraryScope {
  institutionId: string | null
  creatorId: string
  label: string
}

const IMPORT_DESTINATION_KEY = 'sphere_import_destination'

type ContentTable = 'quizzes' | 'exams' | 'courses' | 'learning_paths' | 'guides' | 'notes' | 'documents'

export function destinationInstitutionId(destination: ImportDestination): string | null {
  return destination.kind === 'institution' ? destination.institutionId : null
}

export function destinationKey(destination: ImportDestination): string {
  return destination.kind === 'personal' ? 'personal' : destination.institutionId
}

export function destinationLabel(destination: ImportDestination): string {
  if (destination.kind === 'personal') return 'My personal library'
  return destination.institutionName ?? 'Institution library'
}

/** All shelves this user may import into: personal + each active institution membership. */
export function getImportDestinations(): ImportDestination[] {
  const personal: ImportDestination = { kind: 'personal' }
  const memberships = getCachedMemberships().filter((m) => m.status === 'active')
  const institutions: ImportDestination[] = memberships.map((m) => ({
    kind: 'institution',
    institutionId: m.institution_id,
    institutionName: m.institution_name,
  }))
  return [personal, ...institutions]
}

/** Default import destination: saved preference, else active context, else personal. */
export function getDefaultImportDestination(): ImportDestination {
  const destinations = getImportDestinations()
  if (destinations.length === 1) return destinations[0]

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(IMPORT_DESTINATION_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as ImportDestination
        if (saved.kind === 'personal' && destinations.some((d) => d.kind === 'personal')) {
          return { kind: 'personal' }
        }
        if (saved.kind === 'institution') {
          const match = destinations.find(
            (d) => d.kind === 'institution' && d.institutionId === saved.institutionId
          )
          if (match) return match
        }
      }
    } catch {
      // ignore invalid saved preference
    }
  }

  const ctx = getActiveContext()
  if (ctx.type === 'institution') {
    const match = destinations.find(
      (d) => d.kind === 'institution' && d.institutionId === ctx.institutionId
    )
    if (match) return match
  }

  return { kind: 'personal' }
}

export function saveImportDestination(destination: ImportDestination) {
  if (typeof window === 'undefined') return
  localStorage.setItem(IMPORT_DESTINATION_KEY, JSON.stringify(destination))
}

/** Resolve which shelf the Content library should show for the current workspace. */
export function resolveLibraryScope(): LibraryScope {
  const user = getCurrentUser()
  const ctx = getActiveContext()

  if (ctx.type === 'institution') {
    return {
      institutionId: ctx.institutionId,
      creatorId: user.id,
      label: ctx.institutionName,
    }
  }

  return {
    institutionId: null,
    creatorId: user.id,
    label: 'Personal library',
  }
}

/** Apply institution or personal filters to a Supabase content query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyScopeToQuery(query: any, scope: LibraryScope) {
  if (scope.institutionId) {
    return query.eq('institution_id', scope.institutionId)
  }
  return query.eq('creator_id', scope.creatorId).is('institution_id', null)
}

export async function fetchScopedContent<T>(
  table: ContentTable,
  scope: LibraryScope,
  orderBy: { column: string; ascending?: boolean } = { column: 'created_at', ascending: false }
): Promise<T[]> {
  let query = supabase.from(table).select('*')
  query = applyScopeToQuery(query, scope)
  query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false })
  const { data } = await query
  return (data ?? []) as T[]
}

const RESOURCE_TYPE_TO_MODULE: Record<MarketplaceResourceType, ModuleKey> = {
  engage_game: 'engage',
  lesson_plan: 'learn',
  question_bank: 'assess',
  train_track: 'train',
  reading_material: 'learn',
}

const LISTING_TYPE_TO_MODULE: Record<string, ModuleKey> = {
  quiz: 'engage',
  course: 'learn',
  exam: 'assess',
  training_path: 'train',
  guide: 'learn',
  notes: 'learn',
  document: 'learn',
}

export function moduleForResourceType(type: MarketplaceResourceType): ModuleKey {
  return RESOURCE_TYPE_TO_MODULE[type] ?? 'learn'
}

export function moduleForListingType(type: string): ModuleKey {
  return LISTING_TYPE_TO_MODULE[type] ?? 'learn'
}

export const LIBRARY_TAB_FOR_MODULE: Record<ModuleKey, string> = {
  engage: 'quizzes',
  assess: 'exams',
  learn: 'courses',
  train: 'paths',
}
