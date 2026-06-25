import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface IncomingMember {
  name: string
  email: string
  groups?: string[]
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rosterId } = await params
  const admin = getAdminClient()

  if (!admin) {
    return NextResponse.json(
      { error: 'Roster import is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null)
  const members: IncomingMember[] = body?.members ?? []
  const institutionId: string | undefined = body?.institution_id
  const memberStatus: 'active' | 'pending' = body?.status === 'pending' ? 'pending' : 'active'

  if (!institutionId || members.length === 0) {
    return NextResponse.json({ error: 'Nothing to import.' }, { status: 400 })
  }

  const { data: roster, error: rosterError } = await admin
    .from('rosters')
    .select('id, institution_id')
    .eq('id', rosterId)
    .single()

  if (rosterError || !roster || roster.institution_id !== institutionId) {
    return NextResponse.json({ error: 'Roster not found.' }, { status: 404 })
  }

  const results: { email: string; status: 'added' | 'failed'; reason?: string }[] = []

  for (const member of members) {
    const email = member.email?.trim().toLowerCase()
    const name = member.name?.trim()
    if (!email || !name) {
      results.push({ email: email ?? '(missing)', status: 'failed', reason: 'Missing name or email' })
      continue
    }

    try {
      let userId: string

      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name },
        })

        if (createError || !created.user) {
          results.push({ email, status: 'failed', reason: createError?.message ?? 'Could not create account' })
          continue
        }

        userId = created.user.id
        const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

        const { error: profileError } = await admin.from('users').insert({
          id: userId,
          institution_id: institutionId,
          name,
          email,
          role: 'student',
          avatar_initials: initials,
        })

        if (profileError) {
          results.push({ email, status: 'failed', reason: profileError.message })
          continue
        }
      }

      const { error: memberError } = await admin
        .from('roster_members')
        .upsert(
          { roster_id: rosterId, user_id: userId, groups: member.groups ?? [], status: memberStatus },
          { onConflict: 'roster_id,user_id' }
        )

      if (memberError) {
        results.push({ email, status: 'failed', reason: memberError.message })
        continue
      }

      results.push({ email, status: 'added' })
    } catch (e) {
      results.push({ email, status: 'failed', reason: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results })
}
