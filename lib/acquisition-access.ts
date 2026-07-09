'use client'

import { supabase } from './supabase'
import { applyScopeToQuery, resolveLibraryScope, type LibraryScope } from './library-scope'
import { canAccessModule, type Module } from './subscription'
import { isSelfServeSubmissionForUser } from './self-take'

export type ContentTable = 'quizzes' | 'exams' | 'courses' | 'learning_paths'
export type AcquisitionKind = 'quiz' | 'exam' | 'course' | 'path'

const MODULE_TABLE: Record<Module, ContentTable | null> = {
  engage: 'quizzes',
  assess: 'exams',
  learn: 'courses',
  train: 'learning_paths',
}

const KIND_TABLE: Record<AcquisitionKind, ContentTable> = {
  quiz: 'quizzes',
  exam: 'exams',
  course: 'courses',
  path: 'learning_paths',
}

const CONTENT_TABLES: ContentTable[] = ['quizzes', 'exams', 'courses', 'learning_paths']

export function isAcquiredRow(row: Record<string, unknown>): boolean {
  const settings = row.settings as Record<string, unknown> | undefined
  return Boolean(
    row.marketplace_listing_id ||
      settings?.imported_from_marketplace ||
      settings?.imported_from_listing
  )
}

function contentMatchesImport(
  row: Record<string, unknown>,
  imp: { listing_id?: string | null; resource_id?: string | null; imported_at?: string | null },
  resourceTitle?: string | null
): boolean {
  const settings = row.settings as Record<string, unknown> | undefined
  if (imp.listing_id && row.marketplace_listing_id === imp.listing_id) return true
  if (imp.listing_id && settings?.imported_from_listing === imp.listing_id) return true
  if (imp.resource_id && settings?.imported_from_marketplace === imp.resource_id) return true
  if (imp.imported_at && row.created_at === imp.imported_at) return true
  if (resourceTitle && row.title === resourceTitle && imp.imported_at) {
    const impTime = new Date(imp.imported_at).getTime()
    const rowTime = new Date(row.created_at as string).getTime()
    if (Math.abs(rowTime - impTime) < 120000) return true
  }
  return false
}

async function fetchImportsForScope(scope: LibraryScope) {
  let query = supabase.from('marketplace_imports').select('listing_id, resource_id, imported_at')
  query = scope.institutionId
    ? query.eq('institution_id', scope.institutionId)
    : query.is('institution_id', null).eq('imported_by', scope.creatorId)
  const { data } = await query
  return data ?? []
}

async function resolveImportTitles(
  imports: { listing_id?: string | null; resource_id?: string | null; imported_at?: string | null }[]
): Promise<Map<string, string | null>> {
  const titles = new Map<string, string | null>()
  const listingIds = [...new Set(imports.map((i) => i.listing_id).filter(Boolean))] as string[]
  const resourceIds = [...new Set(imports.map((i) => i.resource_id).filter(Boolean))] as string[]

  if (listingIds.length) {
    const { data } = await supabase.from('marketplace_listings').select('id, title').in('id', listingIds)
    for (const row of data ?? []) {
      titles.set(`listing:${row.id}`, row.title as string)
    }
  }

  if (resourceIds.length) {
    const { data } = await supabase.from('marketplace_resources').select('id, title').in('id', resourceIds)
    for (const row of data ?? []) {
      titles.set(`resource:${row.id}`, row.title as string)
    }
  }

  return titles
}

function importTitle(
  imp: { listing_id?: string | null; resource_id?: string | null },
  titleMap: Map<string, string | null>
): string | null {
  if (imp.listing_id) {
    const t = titleMap.get(`listing:${imp.listing_id}`)
    if (t) return t
  }
  if (imp.resource_id) {
    const t = titleMap.get(`resource:${imp.resource_id}`)
    if (t) return t
  }
  return null
}

/** All content row IDs on this shelf that count as marketplace acquisitions. */
export async function fetchAcquiredContentIds(scope?: LibraryScope): Promise<Set<string>> {
  const libraryScope = scope ?? resolveLibraryScope()
  const ids = new Set<string>()
  const imports = await fetchImportsForScope(libraryScope)
  if (!imports.length) return ids

  const titleMap = await resolveImportTitles(imports)

  for (const table of CONTENT_TABLES) {
    let query = supabase
      .from(table)
      .select('id, marketplace_listing_id, settings, title, created_at')
    query = applyScopeToQuery(query, libraryScope)
    const { data: rows } = await query
    for (const row of rows ?? []) {
      const record = row as Record<string, unknown>
      if (isAcquiredRow(record)) {
        ids.add(record.id as string)
        continue
      }
      for (const imp of imports) {
        const title = importTitle(imp, titleMap)
        if (contentMatchesImport(record, imp, title)) {
          ids.add(record.id as string)
          break
        }
      }
    }
  }

  return ids
}

export async function isAcquiredContent(table: ContentTable, id: string): Promise<boolean> {
  const { data: row } = await supabase
    .from(table)
    .select('id, marketplace_listing_id, settings, title, created_at, creator_id, institution_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) return false

  const record = row as Record<string, unknown>
  if (isAcquiredRow(record)) return true

  const scope: LibraryScope = {
    institutionId: row.institution_id as string | null,
    creatorId: row.creator_id as string,
    label: '',
  }
  const imports = await fetchImportsForScope(scope)
  if (!imports.length) return false

  const titleMap = await resolveImportTitles(imports)
  return imports.some((imp) => contentMatchesImport(record, imp, importTitle(imp, titleMap)))
}

export function getAcquisitionUseHref(kind: AcquisitionKind, id: string): string {
  switch (kind) {
    case 'quiz':
      return '/engage'
    case 'course':
      return `/student/learn/${id}?from=library`
    case 'exam':
      return `/platform/use/assess/${id}`
    case 'path':
      return `/student/train/${id}?from=library`
  }
}

export function getAcquisitionTakeLabel(kind: AcquisitionKind): string {
  switch (kind) {
    case 'quiz':
      return 'Play quiz'
    case 'exam':
      return 'Take assessment'
    case 'course':
      return 'Start course'
    case 'path':
      return 'Start training'
  }
}

export async function canUseAcquiredRoute(module: Module, resourceId?: string): Promise<boolean> {
  if (await canAccessModule(module)) return true
  if (!resourceId) return false
  const table = MODULE_TABLE[module]
  if (!table) return false
  return isAcquiredContent(table, resourceId)
}

export async function resolveAcquiredRouteAccess(
  pathname: string,
  searchParams: URLSearchParams
): Promise<boolean> {
  if (pathname.startsWith('/platform/use/assess/')) {
    const id = pathname.split('/')[4]
    return id ? canUseAcquiredRoute('assess', id) : false
  }

  if (pathname.startsWith('/student/learn/')) {
    const id = pathname.split('/')[3]
    return id ? canUseAcquiredRoute('learn', id) : false
  }

  if (pathname.startsWith('/student/train/')) {
    const id = pathname.split('/')[3]
    return id ? canUseAcquiredRoute('train', id) : false
  }

  if (pathname.startsWith('/student/assess/results/')) {
    const { getCurrentUser } = await import('./auth')
    const user = getCurrentUser()
    const submissionId = pathname.split('/')[4]
    if (!submissionId || !user?.id) return false
    return isSelfServeSubmissionForUser(submissionId, user.id)
  }

  return false
}

export function tableForKind(kind: AcquisitionKind): ContentTable {
  return KIND_TABLE[kind]
}
