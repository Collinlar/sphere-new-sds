import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getListingOutline } from '@/lib/marketplace-outline'

async function isSphereStaff(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const admin = getSupabaseAdmin()
  if (!admin) return false
  const { data: userData } = await admin.auth.getUser(token)
  const uid = userData.user?.id
  if (!uid) return false
  const { data } = await admin.from('users').select('is_sphere_staff').eq('id', uid).maybeSingle()
  return Boolean(data?.is_sphere_staff)
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 })
  }

  const staff = await isSphereStaff(req.headers.get('authorization'))
  const outline = await getListingOutline(id, staff)

  if (!outline) {
    return NextResponse.json({ error: 'Listing not found or not available.' }, { status: 404 })
  }

  return NextResponse.json({ outline, staff })
}
