import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { addCredits, type CreditOwnerType } from '@/lib/ai-credits'

/**
 * Staff-only credit adjustments: comping a creator, refunding a failed run,
 * or seeding an institution. Credit writes need the service role, so they
 * cannot happen from the browser client under RLS.
 */
async function getStaffUserId(): Promise<string | null> {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data: profile } = await admin
    .from('users')
    .select('is_sphere_staff')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.is_sphere_staff ? user.id : null
}

export async function POST(req: NextRequest) {
  const staffId = await getStaffUserId()
  if (!staffId) {
    return NextResponse.json({ error: 'Staff access only.' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Credit adjustment is not configured.' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const ownerType = body?.ownerType as CreditOwnerType | undefined
  const ownerId = body?.ownerId as string | undefined
  const amount = Number(body?.amount)
  const reason = (body?.reason as string | undefined)?.trim() || 'Adjusted by Sphere staff'

  if (!ownerType || !ownerId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Give an owner and a positive amount.' }, { status: 400 })
  }

  const result = await addCredits(admin, { ownerType, ownerId }, amount, 'admin_grant', reason, staffId)
  if (!result.ok) {
    return NextResponse.json({ error: 'That adjustment did not save.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, balance: result.balance })
}
