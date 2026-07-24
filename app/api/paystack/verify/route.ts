import { NextRequest, NextResponse } from 'next/server'
import { verifyTransaction } from '@/lib/paystack'
import { fulfillPayment } from '@/lib/payments'

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) {
    return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 })
  }

  const verified = await verifyTransaction(reference)
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error ?? 'Payment was not successful.' }, { status: 400 })
  }

  const fulfilled = await fulfillPayment(reference)
  if (!fulfilled.ok) {
    return NextResponse.json({ error: fulfilled.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    reference,
    status: verified.status,
    receipt: fulfilled.receipt ?? null,
  })
}
