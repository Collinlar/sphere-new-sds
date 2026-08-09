'use client'

import type { MarketplacePurchaseReceipt } from './marketplace-receipt'

export type CheckoutIntentType =
  | 'subscription'
  | 'addon'
  | 'marketplace'
  | 'plan_switch'
  | 'institution_deposit'
  | 'credit_pack'

export interface CheckoutPayload {
  planId?: string
  addOnId?: string
  listingId?: string
  institutionId?: string
  importDestinationKind?: 'personal' | 'institution'
  inquiryId?: string
  creditPackId?: string
  creditOwnerType?: 'user' | 'institution'
}

export async function startCheckout(params: {
  intentType: CheckoutIntentType
  payload: CheckoutPayload
  callbackPath?: string
}): Promise<{ ok: true; authorizationUrl?: string; switched?: boolean } | { ok: false; error: string }> {
  const res = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intentType: params.intentType,
      payload: params.payload,
      callbackPath: params.callbackPath,
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error ?? 'Checkout did not start. Try again.' }
  }

  if (body.switched) {
    return { ok: true, switched: true }
  }

  if (body.authorizationUrl) {
    window.location.href = body.authorizationUrl as string
    return { ok: true, authorizationUrl: body.authorizationUrl as string }
  }

  return { ok: false, error: 'Checkout did not return a payment link.' }
}

export async function verifyCheckoutReference(
  reference: string
): Promise<
  | { ok: true; receipt?: MarketplacePurchaseReceipt | null }
  | { ok: false; error: string }
> {
  const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error ?? 'Payment verification failed.' }
  }
  return { ok: true, receipt: (body?.receipt as MarketplacePurchaseReceipt | null | undefined) ?? null }
}

/** What actually came back versus what the user asked for. */
export interface AiGenerationMeta {
  requested?: number
  delivered?: number
  shortfall?: number
  truncated?: boolean
  generationsUsed?: number
  generationsLimit?: number
}

/**
 * A plain warning when the draft came back short. Returns '' when the user
 * got everything they asked for, so callers can render it unconditionally.
 */
export function shortfallNotice(
  meta: AiGenerationMeta | undefined,
  delivered: number,
  noun: string
): string {
  const requested = Number(meta?.requested ?? 0)
  if (!requested || delivered >= requested) return ''
  return `${delivered} of ${requested} ${noun} came back. Draft again with append to top up.`
}

export async function generateWithAi(params: {
  addOnId: string
  task:
    | 'assessment_questions'
    | 'course_modules'
    | 'engage_questions'
    | 'training_steps'
    | 'question_hint'
    | 'question_explanation'
    | 'bulk_explanations'
    | 'bulk_hints'
  prompt?: string
  context?: Record<string, unknown>
}): Promise<
  | { ok: true; data: Record<string, unknown>; meta?: AiGenerationMeta }
  | { ok: false; error: string }
> {
  // Institution work bills the institution's pooled credits. Sent on every
  // call so no builder has to remember; the server verifies membership.
  const { creditContextInstitutionId } = await import('./ai-credits-client')
  const institutionId = creditContextInstitutionId()

  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      context: { ...(params.context ?? {}), institutionId },
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error ?? 'AI generation failed. Try again.' }
  }

  return {
    ok: true,
    data: body.data as Record<string, unknown>,
    meta: body.meta as AiGenerationMeta | undefined,
  }
}
