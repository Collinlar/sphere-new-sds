/** Default onboarding deposit in GHS. Override with INSTITUTION_ONBOARDING_DEPOSIT_GHS on the server. */
export const INSTITUTION_ONBOARDING_DEPOSIT_GHS = 500

export function resolveInstitutionOnboardingDepositGhs(): number {
  const raw = process.env.INSTITUTION_ONBOARDING_DEPOSIT_GHS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : INSTITUTION_ONBOARDING_DEPOSIT_GHS
}
