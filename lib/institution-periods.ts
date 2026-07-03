import type { InstitutionType } from './types'

export function getAcademicYearLabel(startMonth: number, now = new Date()): string {
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= startMonth) return `${year}/${year + 1}`
  return `${year - 1}/${year}`
}

export function getPeriodLabels(periodLanguage: string, periodCount: number): string[] {
  return Array.from({ length: periodCount }, (_, i) => `${periodLanguage} ${i + 1}`)
}

export function getCurrentPeriodLabel(type: InstitutionType, now = new Date()): string {
  const labels = getPeriodLabels(type.period_language, type.period_count)
  if (labels.length === 0) return type.period_language

  const startMonth = type.academic_year_start_month ?? 9
  const month = now.getMonth() + 1
  const yearStartMonth = startMonth
  let monthsIntoYear = month - yearStartMonth
  if (monthsIntoYear < 0) monthsIntoYear += 12

  const monthsPerPeriod = Math.max(1, Math.floor(12 / Math.max(type.period_count, 1)))
  const index = Math.min(Math.floor(monthsIntoYear / monthsPerPeriod), labels.length - 1)
  return labels[index]
}

export function formatInstitutionCalendar(type: InstitutionType, now = new Date()): {
  academicYear: string
  currentPeriod: string
  periodLanguage: string
  periodCount: number
} {
  return {
    academicYear: getAcademicYearLabel(type.academic_year_start_month ?? 9, now),
    currentPeriod: getCurrentPeriodLabel(type, now),
    periodLanguage: type.period_language,
    periodCount: type.period_count,
  }
}
