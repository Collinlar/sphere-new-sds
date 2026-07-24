'use client'

import { useEffect, useState, use, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { assertCanTakeAcquired, isSelfServeEngageForUser } from '@/lib/self-take'
import type { Quiz, QuizQuestion } from '@/lib/types'
import { IconCheck } from '@/components/icons'

const ANSWER_COLORS: Record<string, string> = { A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010' }

type Phase = 'loading' | 'question' | 'result' | 'final' | 'error'

function SelfEngagePlayInner({ quizId }: { quizId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const participantId = searchParams.get('participant')

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [answering, setAnswering] = useState(false)

  const questions = quiz?.questions ?? []
  const currentQ: QuizQuestion | undefined = questions[index]
  const timePerQuestion = Number((quiz?.settings as { time_per_question?: number } | undefined)?.time_per_question ?? 30)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const user = getCurrentUser()
      if (!user?.id || !sessionId || !participantId) {
        if (!cancelled) {
          setError('This practice link is incomplete. Open the quiz from your library again.')
          setPhase('error')
        }
        return
      }

      const gate = await assertCanTakeAcquired('quizzes', quizId)
      if (!gate.ok) {
        if (!cancelled) {
          setError(gate.error)
          setPhase('error')
        }
        return
      }

      const owned = await isSelfServeEngageForUser(sessionId, user.id)
      if (!owned) {
        if (!cancelled) {
          setError('This practice session is not linked to your account.')
          setPhase('error')
        }
        return
      }

      const { data: quizRow, error: quizErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .maybeSingle()

      if (quizErr || !quizRow) {
        // Fallback: playable API in case RLS still blocks unpublished quiz
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const res = await fetch(
          `/api/engage/playable-by-quiz?quizId=${encodeURIComponent(quizId)}&session=${encodeURIComponent(sessionId)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body.quiz) {
          if (!cancelled) {
            setError(body.error ?? 'Could not load this quiz.')
            setPhase('error')
          }
          return
        }
        if (!cancelled) {
          const q = body.quiz as Quiz
          setQuiz({ ...q, questions: Array.isArray(q.questions) ? q.questions : [] })
          setPhase('question')
          setTimeLeft(Number((q.settings as { time_per_question?: number } | undefined)?.time_per_question ?? 30))
        }
        return
      }

      if (!cancelled) {
        const q = quizRow as Quiz
        setQuiz({ ...q, questions: Array.isArray(q.questions) ? q.questions : [] })
        setPhase('question')
        setTimeLeft(Number((q.settings as { time_per_question?: number } | undefined)?.time_per_question ?? timePerQuestion))
      }
    }

    boot()
    return () => { cancelled = true }
  }, [quizId, sessionId, participantId, timePerQuestion])

  const advanceAfterResult = useCallback(() => {
    const next = index + 1
    if (next >= questions.length) {
      setPhase('final')
      if (sessionId) {
        void (async () => {
          const { data: row } = await supabase
            .from('engage_sessions')
            .select('settings')
            .eq('id', sessionId)
            .maybeSingle()
          const base = (row?.settings ?? {}) as Record<string, unknown>
          await supabase
            .from('engage_sessions')
            .update({
              status: 'ended',
              ended_at: new Date().toISOString(),
              settings: { ...base, live_phase: 'ended' },
            })
            .eq('id', sessionId)
        })()
      }
      return
    }
    setIndex(next)
    setSelected(null)
    setWasCorrect(null)
    setPointsEarned(0)
    setTimeLeft(timePerQuestion)
    setPhase('question')
    if (sessionId) {
      void supabase.from('engage_sessions').update({ current_question_index: next }).eq('id', sessionId)
    }
  }, [index, questions.length, sessionId, timePerQuestion])

  useEffect(() => {
    if (phase !== 'question' || selected) return
    if (timeLeft <= 0) {
      void handleAnswer(null)
      return
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, selected])

  useEffect(() => {
    if (phase !== 'result') return
    const t = setTimeout(advanceAfterResult, 1400)
    return () => clearTimeout(t)
  }, [phase, advanceAfterResult])

  async function handleAnswer(label: string | null) {
    if (answering || selected || !currentQ || !sessionId || !participantId) return
    setAnswering(true)

    const correct = label != null && currentQ.correct === label
    const pts = correct ? currentQ.points : 0
    const nextScore = totalScore + pts

    setSelected(label ?? '')
    setWasCorrect(correct)
    setPointsEarned(pts)
    setTotalScore(nextScore)

    await supabase.from('session_participants').update({ score: nextScore }).eq('id', participantId)
    if (label) {
      await supabase.from('session_responses').insert({
        session_id: sessionId,
        participant_id: participantId,
        question_index: index,
        answer: label,
        is_correct: correct,
        points_earned: pts,
      })
    }

    setAnswering(false)
    setPhase('result')
  }

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading your quiz...</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Play quiz" />
        <div style={{ padding: '48px 32px', maxWidth: 480 }}>
          <p style={{ fontSize: 14, color: 'var(--coral)', marginBottom: 16, lineHeight: 1.5 }}>
            {error ?? 'Could not open this quiz.'}
          </p>
          <Link href="/platform/library" style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none' }}>
            Back to library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0C1021',
      color: '#fff',
      fontFamily: 'var(--font)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {(phase === 'question' || phase === 'result') && currentQ && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                Question {index + 1} of {questions.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#D97010' }}>{totalScore} pts</span>
                {phase === 'question' && (
                  <span style={{
                    background: '#D97010', borderRadius: 8, padding: '6px 12px',
                    fontSize: 16, fontWeight: 800,
                  }}>
                    0:{timeLeft.toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '22px 20px', marginBottom: 18, textAlign: 'center',
            }}>
              <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4 }}>{currentQ.text}</p>
            </div>

            {phase === 'question' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentQ.options.filter((o) => o.text?.trim()).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleAnswer(opt.label)}
                    disabled={!!selected || answering}
                    style={{
                      width: '100%',
                      background: ANSWER_COLORS[opt.label] ?? '#2E2886',
                      border: 'none',
                      borderRadius: 12,
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: selected ? 'default' : 'pointer',
                      minHeight: 56,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.25)',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{opt.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
                  </button>
                ))}
              </div>
            )}

            {phase === 'result' && (
              <div style={{ textAlign: 'center', paddingTop: 12 }}>
                <div style={{
                  width: 84, height: 84, borderRadius: '50%', margin: '0 auto 16px',
                  background: wasCorrect ? '#1A8966' : '#C23B2A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {wasCorrect ? <IconCheck size={36} /> : <span style={{ fontSize: 28, fontWeight: 700 }}>✕</span>}
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                  {wasCorrect ? 'Correct!' : selected ? 'Wrong answer' : 'Time up'}
                </p>
                {wasCorrect && <p style={{ fontSize: 28, fontWeight: 700, color: '#D97010' }}>+{pointsEarned} pts</p>}
              </div>
            )}
          </>
        )}

        {phase === 'final' && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,159,39,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              color: '#D97010',
            }}>
              <IconCheck size={36} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Practice complete</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
              {quiz?.title ?? 'Quiz'} · {questions.length} questions
            </p>
            <div style={{
              background: 'rgba(239,159,39,0.15)', border: '0.5px solid #D97010',
              borderRadius: 16, padding: '24px 32px', marginBottom: 24,
            }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your score</p>
              <p style={{ fontSize: 48, fontWeight: 700, color: '#D97010' }}>{totalScore}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => router.replace(`/platform/use/engage/${quizId}`)}
                style={{
                  width: '100%', background: '#D97010', border: 'none', borderRadius: 12,
                  padding: '14px 18px', fontSize: 15, fontWeight: 700, color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', minHeight: 48,
                }}
              >
                Play again
              </button>
              <Link
                href="/platform/library"
                style={{
                  width: '100%', textAlign: 'center', background: 'rgba(255,255,255,0.08)',
                  border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 12,
                  padding: '14px 18px', fontSize: 14, fontWeight: 600, color: '#fff',
                  textDecoration: 'none', boxSizing: 'border-box',
                }}
              >
                Back to library
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SelfEngagePlayPage({ params: paramsPromise }: { params: Promise<{ quizId: string }> }) {
  const params = use(paramsPromise)
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading your quiz...</p>
      </div>
    }>
      <SelfEngagePlayInner quizId={params.quizId} />
    </Suspense>
  )
}
