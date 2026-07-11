import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { InstitutionLevel, InstitutionType } from './types'

export const DEFAULT_GRADE_LEVELS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3',
]

function normaliseLevels(raw: unknown): InstitutionLevel[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is InstitutionLevel =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as InstitutionLevel).id === 'string' &&
      typeof (item as InstitutionLevel).label === 'string'
    )
    .map((item) => ({ id: item.id, label: item.label }))
}

export async function fetchInstitutionTypeByInstitutionId(
  institutionId: string
): Promise<InstitutionType | null> {
  const { data: institution } = await supabase
    .from('institutions')
    .select('institution_type_id, academic_year_start_month, custom_levels, extra_level_type_ids')
    .eq('id', institutionId)
    .single()

  if (!institution?.institution_type_id) return null

  const { data: typeRow } = await supabase
    .from('institution_types')
    .select('id, name, period_language, period_count, levels, academic_year_start_month, level_language, calendar_language, has_academic_calendar, is_custom')
    .eq('id', institution.institution_type_id)
    .single()

  if (!typeRow) return null

  // Levels = the primary type's seeded levels, plus any borrowed level
  // groups (a university that also runs corporate training enables the
  // corporate group), plus the institution's own custom levels.
  // Seeded levels always stay — content may reference them.
  let levels = normaliseLevels(typeRow.levels)

  const extraIds = (institution.extra_level_type_ids ?? []) as string[]
  if (extraIds.length) {
    const { data: extraTypes } = await supabase
      .from('institution_types')
      .select('id, levels')
      .in('id', extraIds)
    for (const t of extraTypes ?? []) {
      levels = levels.concat(normaliseLevels(t.levels))
    }
  }

  levels = levels.concat(normaliseLevels(institution.custom_levels))

  // Dedupe by id, first occurrence wins.
  const seen = new Set<string>()
  levels = levels.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true)))

  return {
    ...typeRow,
    levels,
    // Per-institution calendar override beats the type default.
    academic_year_start_month:
      institution.academic_year_start_month ?? typeRow.academic_year_start_month,
    is_custom: typeRow.is_custom ?? false,
  } as InstitutionType
}

/**
 * Change an institution's primary type safely. The outgoing type's levels
 * are preserved as custom_levels so any content that references them is
 * never orphaned, and the switch is appended to type_change_log for audit.
 */
export async function changeInstitutionType(
  institutionId: string,
  newTypeId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: inst } = await supabase
    .from('institutions')
    .select('institution_type_id, custom_levels, type_change_log')
    .eq('id', institutionId)
    .maybeSingle()

  const oldTypeId = (inst?.institution_type_id as string) ?? null
  if (oldTypeId === newTypeId) return { ok: true }

  // The levels the institution effectively uses today, before the switch.
  const priorEffective = oldTypeId
    ? (await fetchInstitutionTypeByInstitutionId(institutionId))?.levels ?? []
    : []

  // The new type's own seeded levels — anything the prior set had that the
  // new type does not is preserved as a custom level.
  const { data: newTypeRow } = await supabase
    .from('institution_types')
    .select('levels')
    .eq('id', newTypeId)
    .maybeSingle()
  const newTypeLevels = normaliseLevels(newTypeRow?.levels)
  const newIds = new Set(newTypeLevels.map(l => l.id))

  const existingCustom = normaliseLevels(inst?.custom_levels)
  const merged = existingCustom.slice()
  const mergedIds = new Set(merged.map(l => l.id))
  for (const lvl of priorEffective) {
    if (!newIds.has(lvl.id) && !mergedIds.has(lvl.id)) {
      merged.push(lvl)
      mergedIds.add(lvl.id)
    }
  }

  const log = Array.isArray(inst?.type_change_log) ? inst!.type_change_log : []
  log.push({ from: oldTypeId, to: newTypeId, at: new Date().toISOString() })

  const { error } = await supabase
    .from('institutions')
    .update({ institution_type_id: newTypeId, custom_levels: merged, type_change_log: log })
    .eq('id', institutionId)

  if (error) return { ok: false, error: 'That type change did not save. Try again.' }
  return { ok: true }
}

export async function fetchInstitutionLevelsForUser(): Promise<string[]> {
  const user = getCurrentUser()
  if (!user.institution_id) return DEFAULT_GRADE_LEVELS

  const type = await fetchInstitutionTypeByInstitutionId(user.institution_id)
  if (!type?.levels?.length) return DEFAULT_GRADE_LEVELS

  return type.levels.map((level) => level.label)
}

export async function fetchInstitutionTypeForUser(): Promise<InstitutionType | null> {
  const user = getCurrentUser()
  if (!user.institution_id) return null
  return fetchInstitutionTypeByInstitutionId(user.institution_id)
}
