import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Returns the live Engage session + quiz for a join code.
 * Needed because quizzes RLS blocks unpublished content for guests /
 * non-institution players, which left students on a blank question screen.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code || code.length < 4) {
    return NextResponse.json({ error: 'Enter a valid game code.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Session service is not configured.' }, { status: 503 })
  }

  const { data: session, error } = await admin
    .from('engage_sessions')
    .select('*, quizzes(*)')
    .eq('join_code', code)
    .neq('status', 'ended')
    .maybeSingle()

  if (error || !session) {
    return NextResponse.json(
      { error: 'That code does not match an active game. Double-check with your teacher.' },
      { status: 404 },
    )
  }

  const quiz = (session as { quizzes?: unknown }).quizzes
  if (!quiz || typeof quiz !== 'object') {
    return NextResponse.json(
      { error: 'This game has no questions loaded. Ask the host to restart the session.' },
      { status: 404 },
    )
  }

  const questions = Array.isArray((quiz as { questions?: unknown }).questions)
    ? (quiz as { questions: unknown[] }).questions
    : []

  if (questions.length === 0) {
    return NextResponse.json(
      { error: 'This game has no questions yet. Ask the host to add questions and start again.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ session, quiz })
}
