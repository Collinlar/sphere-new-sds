'use client'

export type CheckoutIntentType =
  | 'subscription'
  | 'addon'
  | 'marketplace'
  | 'plan_switch'
  | 'institution_deposit'

export interface CheckoutPayload {
  planId?: string
  addOnId?: string
  listingId?: string
  institutionId?: string
  importDestinationKind?: 'personal' | 'institution'
  inquiryId?: string
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error ?? 'Payment verification failed.' }
  }
  return { ok: true }
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
  prompt?: string
  context?: Record<string, unknown>
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error ?? 'AI generation failed. Try again.' }
  }

  return { ok: true, data: body.data as Record<string, unknown> }
}
