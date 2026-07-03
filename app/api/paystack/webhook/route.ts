import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackSignature } from '@/lib/paystack'
import { fulfillPayment } from '@/lib/payments'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as {
    event?: string
    data?: { reference?: string; status?: string }
  }

  if (event.event !== 'charge.success') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const reference = event.data?.reference
  if (!reference) {
    return NextResponse.json({ error: 'Missing reference.' }, { status: 400 })
  }

  const fulfilled = await fulfillPayment(reference)
  if (!fulfilled.ok) {
    return NextResponse.json({ error: fulfilled.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
