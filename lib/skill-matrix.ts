import type { PathStep } from '@/lib/types'

export const DEFAULT_SKILL_CATEGORIES = [
  'Communication',
  'Data Privacy',
  'Customer Service',
  'Technical',
  'Leadership',
]

/** Infer a skill label for a step when the builder did not set one. */
export function inferStepSkill(step: PathStep, pathCategory?: string | null): string {
  const tagged = (step as PathStep & { skill?: string }).skill?.trim()
  if (tagged) return tagged

  const hay = `${step.title} ${JSON.stringify(step.content ?? {})}`.toLowerCase()
  if (/privacy|gdpr|data protect|confidential/.test(hay)) return 'Data Privacy'
  if (/customer|service|client|support/.test(hay)) return 'Customer Service'
  if (/lead|manage|coach|mentor/.test(hay)) return 'Leadership'
  if (/tech|system|software|tool|ict|code/.test(hay)) return 'Technical'
  if (/communicat|writing|present|speak|meeting/.test(hay)) return 'Communication'

  if (pathCategory) {
    const cat = pathCategory.toLowerCase()
    if (cat.includes('compliance')) return 'Data Privacy'
    if (cat.includes('leadership')) return 'Leadership'
    if (cat.includes('onboarding')) return 'Communication'
    if (cat.includes('skill')) return 'Technical'
  }

  if (step.type === 'sign_off') return 'Data Privacy'
  if (step.type === 'assessment') return 'Technical'
  return 'Communication'
}

export function computeSkillLevels(
  steps: PathStep[],
  completedStepIds: string[],
  pathCategory?: string | null,
  categories: string[] = DEFAULT_SKILL_CATEGORIES,
): number[] {
  const completed = new Set(completedStepIds)
  return categories.map((skill) => {
    const skillSteps = steps.filter((s) => inferStepSkill(s, pathCategory) === skill)
    if (skillSteps.length === 0) return 0
    const done = skillSteps.filter((s) => completed.has(s.id)).length
    return Math.round((done / skillSteps.length) * 5)
  })
}
