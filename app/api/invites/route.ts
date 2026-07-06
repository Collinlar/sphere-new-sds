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

function generateClaimCode(): string {
  // 6 chars, no ambiguous characters (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
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

  if (!institutionId || invites.length === 0) {
    return NextResponse.json({ error: 'Nothing to send.' }, { status: 400 })
  }

  const results: { email: string; status: 'sent' | 'failed'; reason?: string; claim_code?: string }[] = []

  for (const invite of invites) {
    const email = invite.email?.trim().toLowerCase()
    const role = invite.role?.trim() || 'teacher'

    if (!email) {
      results.push({ email: '(missing)', status: 'failed', reason: 'Missing email' })
      continue
    }

    if (!['teacher', 'student', 'admin'].includes(role)) {
      results.push({ email, status: 'failed', reason: 'Invalid role' })
      continue
    }

    try {
      // Does this email already belong to a Sphere account?
      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle()

      // Already a member or already invited?
      let dupeQuery = admin
        .from('institution_members')
        .select('id')
        .eq('institution_id', institutionId)
        .neq('status', 'removed')
      dupeQuery = existingUser
        ? dupeQuery.eq('user_id', existingUser.id)
        : dupeQuery.ilike('invited_email', email)
      const { data: existing } = await dupeQuery.maybeSingle()

      if (existing) {
        results.push({ email, status: 'failed', reason: 'Already a member or invite pending' })
        continue
      }

      const claimCode = generateClaimCode()

      const { error: insertError } = await admin.from('institution_members').insert({
        institution_id: institutionId,
        user_id: existingUser?.id ?? null,
        member_role: role,
        status: 'invited',
        invited_email: email,
        claim_code: claimCode,
        invited_by: invitedBy ?? null,
      })

      if (insertError) {
        results.push({ email, status: 'failed', reason: insertError.message })
        continue
      }

      results.push({ email, status: 'sent', claim_code: claimCode })
    } catch (e) {
      results.push({ email, status: 'failed', reason: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results })
}
