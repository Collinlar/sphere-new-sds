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
    .select('institution_type_id')
    .eq('id', institutionId)
    .single()

  if (!institution?.institution_type_id) return null

  const { data: typeRow } = await supabase
    .from('institution_types')
    .select('id, name, period_language, period_count, levels, academic_year_start_month, is_custom')
    .eq('id', institution.institution_type_id)
    .single()

  if (!typeRow) return null

  return {
    ...typeRow,
    levels: normaliseLevels(typeRow.levels),
    is_custom: typeRow.is_custom ?? false,
  } as InstitutionType
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
