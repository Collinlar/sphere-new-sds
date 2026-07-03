import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { submitInstitutionInquiry } from '@/lib/institution-inquiry'

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

  const { data: profile } = await supabase
    .from('users')
    .select('id, institution_id, role')
    .eq('id', user.id)
    .single()

  return profile
}

export async function POST(req: NextRequest) {
  const profile = await getAuthedUser()
  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'Sign in with an institution account to send this enquiry.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const institutionName = (body?.institutionName as string | undefined)?.trim()
  const contactName = (body?.contactName as string | undefined)?.trim()
  const contactEmail = (body?.contactEmail as string | undefined)?.trim()
  const contactPhone = (body?.contactPhone as string | undefined)?.trim()
  const studentCount = body?.studentCount ? Number(body.studentCount) : undefined
  const message = (body?.message as string | undefined)?.trim()

  if (!institutionName || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'Institution name, contact name, and email are required.' }, { status: 400 })
  }

  const result = await submitInstitutionInquiry({
    userId: profile.id,
    institutionId: profile.institution_id,
    institutionName,
    contactName,
    contactEmail,
    contactPhone,
    studentCount: Number.isFinite(studentCount) ? studentCount : undefined,
    message,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id })
}
