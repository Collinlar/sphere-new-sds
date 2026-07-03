/**
 * Plan privilege matrix — documents and aggregates subscription gates.
 * Enforcement lives in lib/subscription.ts and lib/institution-modules.ts.
 */

import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import {
  getEffectiveModules,
  getPlanIncludedModules,
  isModuleAccessible,
  parseInstitutionModules,
  type ModuleKey,
} from './institution-modules'
import {
  canIssueCertificates,
  canSellOnMarketplace,
  getEffectivePlanId,
  getUserPlan,
  type Module,
} from './subscription'
import type { SubscriptionTier } from './types'

export interface PlanContext {
  planId: SubscriptionTier
  canSellMarketplace: boolean
  canIssueCertificates: boolean
  isSphereStaff: boolean
  sessionStudentCap: number | null
  enrolledStudentCap: number | null
  effectiveModules: ModuleKey[]
}

/** Human-readable privilege summary per plan (for billing / upgrade copy). */
export const PLAN_PRIVILEGE_SUMMARY: Record<SubscriptionTier, string[]> = {
  membership: [
    '5 Assess creations',
    '5 Engage creations',
    'Up to 5 students per live session',
    'Browse and import from marketplace',
    'No marketplace publishing',
    'No certificates',
  ],
  creator_quarterly: [
    '40 creations across all modules',
    'Up to 50 students per live session',
    'Publish and sell on marketplace (15% commission)',
    'Issue certificates',
  ],
  creator_marketplace: [
    'Unlimited creations',
    'Publish and sell on marketplace (30% commission)',
    'Personal creator storefront',
    'Issue certificates',
  ],
  institution: [
    'Unlimited creations',
    'All modules',
    'Up to 100 enrolled students',
    'Publish and sell on marketplace (15% commission)',
    'Certificates and custom templates',
  ],
}

export async function getPlanContext(userId?: string): Promise<PlanContext> {
  const uid = userId ?? getCurrentUser().id
  const [planId, plan] = await Promise.all([
    getEffectivePlanId(uid),
    getUserPlan(),
  ])

  const { data: userRow } = await supabase
    .from('users')
    .select('institution_id, is_sphere_staff')
    .eq('id', uid)
    .maybeSingle()

  let effectiveModules = getPlanIncludedModules(planId)

  if (userRow?.institution_id) {
    const { data: institution } = await supabase
      .from('institutions')
      .select('modules, subscription_plan')
      .eq('id', userRow.institution_id)
      .single()

    if (institution) {
      const provisioned = parseInstitutionModules(institution.modules)
      const instPlan =
        institution.subscription_plan === 'trial'
          ? 'membership'
          : (institution.subscription_plan ?? planId)
      effectiveModules = getEffectiveModules(provisioned, instPlan)
    }
  }

  return {
    planId,
    canSellMarketplace: plan?.can_sell_marketplace ?? false,
    canIssueCertificates: plan?.can_issue_certificates ?? false,
    isSphereStaff: userRow?.is_sphere_staff ?? false,
    sessionStudentCap: plan?.session_student_cap ?? null,
    enrolledStudentCap: plan?.enrolled_student_cap ?? null,
    effectiveModules,
  }
}

export async function canReviewMarketplace(): Promise<boolean> {
  const ctx = await getPlanContext()
  return ctx.isSphereStaff
}

export async function assertMarketplacePublish(): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await canSellOnMarketplace()
  if (!allowed) {
    return {
      ok: false,
      error: 'Your plan does not include marketplace publishing. Upgrade to Creator Quarterly or Institution.',
    }
  }
  return { ok: true }
}

export function isModuleAllowedForPlan(module: ModuleKey, planId: string): boolean {
  return getPlanIncludedModules(planId).includes(module)
}

export function isModuleProvisionedAndAllowed(
  module: ModuleKey,
  provisioned: ModuleKey[],
  planId: string
): boolean {
  return isModuleAccessible(module, provisioned, planId)
}

export { canIssueCertificates, canSellOnMarketplace }
