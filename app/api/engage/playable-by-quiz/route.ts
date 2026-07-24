import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Load quiz content for a self-serve practice session.
 * Used when client RLS blocks unpublished acquired quizzes.
 */
export async function GET(req: NextRequest) {
  const quizId = req.nextUrl.searchParams.get('quizId')?.trim()
  const sessionId = req.nextUrl.searchParams.get('session')?.trim()
  const auth = req.headers.get('authorization')

  if (!quizId || !sessionId) {
    return NextResponse.json({ error: 'Missing quiz or session.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Session service is not configured.' }, { status: 503 })
  }

  let userId: string | null = null
  if (auth?.startsWith('Bearer ')) {
    const { data } = await admin.auth.getUser(auth.slice(7))
    userId = data.user?.id ?? null
  }

  const { data: session } = await admin
    .from('engage_sessions')
    .select('id, quiz_id, settings')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.quiz_id !== quizId) {
    return NextResponse.json({ error: 'Practice session not found.' }, { status: 404 })
  }

  const settings = (session.settings ?? {}) as { self_serve?: boolean; owner_id?: string }
  if (!settings.self_serve) {
    return NextResponse.json({ error: 'This is not a practice session.' }, { status: 403 })
  }
  if (userId && settings.owner_id && settings.owner_id !== userId) {
    return NextResponse.json({ error: 'This practice session belongs to another account.' }, { status: 403 })
  }

  const { data: quiz } = await admin.from('quizzes').select('*').eq('id', quizId).maybeSingle()
  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 })
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : []
  if (questions.length === 0) {
    return NextResponse.json({ error: 'This quiz has no questions yet.' }, { status: 404 })
  }

  return NextResponse.json({ quiz: { ...quiz, questions } })
}
