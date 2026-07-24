import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generatePaymentReference, initializeTransaction } from '@/lib/paystack'
import {
  assertInstitutionDepositCheckout,
  createPaymentIntent,
  resolvePaymentAmount,
  type PaymentIntentType,
  type PaymentPayload,
} from '@/lib/payments'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('users').select('email').eq('id', user.id).single()
  return { id: user.id, email: profile?.email ?? user.email ?? '' }
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in to complete checkout.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const intentType = body?.intentType as PaymentIntentType | undefined
  let payload = (body?.payload ?? {}) as PaymentPayload
  const callbackPath = (body?.callbackPath as string) ?? '/platform/settings/billing'

  if (!intentType) {
    return NextResponse.json({ error: 'Missing checkout type.' }, { status: 400 })
  }

  if (intentType === 'institution_deposit') {
    const gate = await assertInstitutionDepositCheckout(user.id, payload)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 })
    }
  }

  const amountResult = await resolvePaymentAmount(intentType, payload)
  if (!amountResult.ok) {
    return NextResponse.json({ error: amountResult.error }, { status: 400 })
  }

  // Catalog resource IDs may arrive as listingId; store the real approved listing id.
  if (intentType === 'marketplace' && amountResult.resolvedListingId) {
    payload = { ...payload, listingId: amountResult.resolvedListingId }
  }

  const reference = generatePaymentReference(intentType.slice(0, 4).toUpperCase())
  const origin = req.nextUrl.origin
  const callbackUrl = `${origin}${callbackPath}`

  if (intentType === 'plan_switch' && amountResult.amountPesewas === 0) {
    await createPaymentIntent({
      userId: user.id,
      reference,
      intentType,
      payload,
      amountPesewas: 0,
    })

    const { fulfillPayment } = await import('@/lib/payments')
    const fulfilled = await fulfillPayment(reference)
    if (!fulfilled.ok) {
      return NextResponse.json({ error: fulfilled.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reference, switched: true })
  }

  const intentStored = await createPaymentIntent({
    userId: user.id,
    reference,
    intentType,
    payload,
    amountPesewas: amountResult.amountPesewas,
  })

  if (!intentStored.ok) {
    return NextResponse.json({ error: intentStored.error }, { status: 500 })
  }

  const init = await initializeTransaction({
    email: user.email,
    amountPesewas: amountResult.amountPesewas,
    reference,
    callbackUrl,
    metadata: {
      user_id: user.id,
      intent_type: intentType,
      ...payload,
    },
  })

  if (!init.ok) {
    return NextResponse.json({ error: init.error }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    reference: init.reference,
    authorizationUrl: init.authorizationUrl,
    accessCode: init.accessCode,
  })
}
