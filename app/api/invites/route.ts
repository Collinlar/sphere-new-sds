import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface IncomingInvite {
  email: string
  role: string
  department?: string
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest) {
  const admin = getAdminClient()

  if (!admin) {
    return NextResponse.json(
      { error: 'Invites are not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null)
  const invites: IncomingInvite[] = body?.invites ?? []
  const institutionId: string | undefined = body?.institution_id
  const invitedBy: string | undefined = body?.invited_by
  const sendWelcome: boolean = body?.send_welcome !== false

  if (!institutionId || invites.length === 0) {
    return NextResponse.json({ error: 'Nothing to send.' }, { status: 400 })
  }

  const results: { email: string; status: 'sent' | 'failed'; reason?: string }[] = []

  for (const invite of invites) {
    const email = invite.email?.trim().toLowerCase()
    const role = invite.role?.trim() || 'teacher'
    const department = invite.department?.trim() || null

    if (!email) {
      results.push({ email: '(missing)', status: 'failed', reason: 'Missing email' })
      continue
    }

    if (!['teacher', 'student', 'admin'].includes(role)) {
      results.push({ email, status: 'failed', reason: 'Invalid role' })
      continue
    }

    try {
      const { data: existingInvite } = await admin
        .from('user_invites')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()

      if (existingInvite) {
        results.push({ email, status: 'failed', reason: 'Invite already pending' })
        continue
      }

      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (!existingUser) {
        const tempPassword = Math.random().toString(36).slice(2, 14)
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: email.split('@')[0],
            send_welcome: sendWelcome,
          },
        })

        if (createError || !created.user) {
          results.push({ email, status: 'failed', reason: createError?.message ?? 'Could not create account' })
          continue
        }

        const nameFromEmail = email.split('@')[0].replace(/[._]/g, ' ')
        const initials = nameFromEmail.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

        const { error: profileError } = await admin.from('users').insert({
          id: created.user.id,
          institution_id: institutionId,
          name: nameFromEmail,
          email,
          role,
          department,
          avatar_initials: initials || 'U',
        })

        if (profileError) {
          results.push({ email, status: 'failed', reason: profileError.message })
          continue
        }
      }

      const { error: inviteError } = await admin.from('user_invites').insert({
        institution_id: institutionId,
        email,
        role,
        department,
        status: 'pending',
        invited_by: invitedBy ?? null,
      })

      if (inviteError) {
        results.push({ email, status: 'failed', reason: inviteError.message })
        continue
      }

      results.push({ email, status: 'sent' })
    } catch (e) {
      results.push({ email, status: 'failed', reason: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results })
}
