import crypto from 'crypto'

const PAYSTACK_BASE = 'https://api.paystack.co'

export function getPaystackSecretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY ?? null
}

export function getPaystackPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? process.env.PAYSTACK_PUBLIC_KEY ?? null
}

export function ghsToPesewas(amountGhs: number): number {
  return Math.round(amountGhs * 100)
}

export interface PaystackInitResult {
  ok: true
  reference: string
  authorizationUrl: string
  accessCode: string
}

export interface PaystackError {
  ok: false
  error: string
}

export async function initializeTransaction(params: {
  email: string
  amountPesewas: number
  reference: string
  callbackUrl: string
  metadata: Record<string, unknown>
}): Promise<PaystackInitResult | PaystackError> {
  const secret = getPaystackSecretKey()
  if (!secret) {
    return { ok: false, error: 'Payments are not configured on this server yet.' }
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountPesewas,
      currency: 'GHS',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status) {
    return {
      ok: false,
      error: body?.message ?? 'Paystack could not start this checkout. Try again in a moment.',
    }
  }

  return {
    ok: true,
    reference: body.data.reference as string,
    authorizationUrl: body.data.authorization_url as string,
    accessCode: body.data.access_code as string,
  }
}

export async function verifyTransaction(reference: string): Promise<{
  ok: boolean
  status?: string
  amount?: number
  metadata?: Record<string, unknown>
  error?: string
}> {
  const secret = getPaystackSecretKey()
  if (!secret) {
    return { ok: false, error: 'Payments are not configured on this server yet.' }
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status) {
    return { ok: false, error: body?.message ?? 'Could not verify that payment.' }
  }

  return {
    ok: body.data.status === 'success',
    status: body.data.status as string,
    amount: body.data.amount as number,
    metadata: body.data.metadata as Record<string, unknown>,
  }
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = getPaystackSecretKey()
  if (!secret || !signature) return false

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}

export function generatePaymentReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `SPH-${prefix}-${Date.now()}-${rand}`
}
