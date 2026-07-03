export type ModuleKey = 'engage' | 'assess' | 'learn' | 'train'

export const ALL_MODULE_KEYS: ModuleKey[] = ['engage', 'assess', 'learn', 'train']

/** Modules included in each subscription plan (before institution.modules filter). */
export const PLAN_INCLUDED_MODULES: Record<string, ModuleKey[]> = {
  membership: ['engage', 'assess'],
  trial: ['engage', 'assess'],
  creator_quarterly: ALL_MODULE_KEYS,
  creator_marketplace: ALL_MODULE_KEYS,
  institution: ALL_MODULE_KEYS,
}

const MODULE_SET = new Set<string>(ALL_MODULE_KEYS)

function isModuleKey(value: string): value is ModuleKey {
  return MODULE_SET.has(value)
}

/** Normalise institution.modules from array, boolean map, or JSON string. */
export function parseInstitutionModules(raw: unknown): ModuleKey[] {
  if (Array.isArray(raw)) {
    return raw.filter((m): m is ModuleKey => typeof m === 'string' && isModuleKey(m))
  }

  if (typeof raw === 'string') {
    try {
      return parseInstitutionModules(JSON.parse(raw))
    } catch {
      return []
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw as Record<string, boolean>)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .filter(isModuleKey)
  }

  return []
}

export function getPlanIncludedModules(planId: string): ModuleKey[] {
  return PLAN_INCLUDED_MODULES[planId] ?? PLAN_INCLUDED_MODULES.membership
}

/** Modules the institution has provisioned and the plan allows. */
export function getEffectiveModules(provisioned: ModuleKey[], planId: string): ModuleKey[] {
  const included = new Set(getPlanIncludedModules(planId))
  return provisioned.filter((m) => included.has(m))
}

export function isModuleAccessible(
  module: ModuleKey,
  provisioned: ModuleKey[],
  planId: string
): boolean {
  return getEffectiveModules(provisioned, planId).includes(module)
}

export function getPlanModuleDescription(planId: string): string {
  switch (planId) {
    case 'membership':
    case 'trial':
      return 'Free plan · 5 Assess · 5 Engage creations'
    case 'creator_quarterly':
      return '40 creations across all modules · redistribute anytime'
    case 'creator_marketplace':
      return 'Unlimited creations · marketplace sales'
    case 'institution':
      return 'All modules · unlimited creations · up to 100 students'
    default:
      return 'See billing for plan details'
  }
}
