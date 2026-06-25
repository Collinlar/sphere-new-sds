'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EngageSession, Quiz, SessionParticipant, QuizQuestion } from '@/lib/types'

const ANSWER_COLORS: Record<string, string> = { A: '#36318F', B: '#2BA888', C: '#E05C4B', D: '#EF9F27' }
const ANSWER_LABELS: Record<string, string> = { A: 'A', B: 'B', C: 'C', D: 'D' }

type HostPhase = 'lobby' | 'question' | 'reveal' | 'end'

export default function EngageSessionHost() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<EngageSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [phase, setPhase] = useState<HostPhase>('lobby')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('engage_sessions')
        .select('*, quizzes(*), session_participants(*)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Could not load this session. Check your connection.')
        setLoading(false)
        return
      }

      setSession(data as EngageSession)
      setQuiz((data as { quizzes: Quiz }).quizzes)
      setParticipants((data as { session_participants: SessionParticipant[] }).session_participants ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`session-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${id}` }, () => {
        supabase.from('session_participants').select('*').eq('session_id', id).then(({ data }) => {
          if (data) setParticipants(data)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) {
      if (timerActive && timeLeft <= 0) {
        setTimerActive(false)
        setPhase('reveal')
      }
      return
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timerActive, timeLeft])

  const startGame = useCallback(async () => {
    await supabase.from('engage_sessions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id)
    const q = quiz?.questions[0]
    if (q) {
      setTimeLeft(q.time_seconds)
      setTimerActive(true)
    }
    setPhase('question')
    setQuestionIndex(0)
  }, [id, quiz])

  const revealAnswer = useCallback(() => {
    setTimerActive(false)
    setPhase('reveal')
  }, [])

  const nextQuestion = useCallback(() => {
    const nextIdx = questionIndex + 1
    if (!quiz || nextIdx >= quiz.questions.length) {
      setPhase('end')
      supabase.from('engage_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id)
      return
    }
    setQuestionIndex(nextIdx)
    const q = quiz.questions[nextIdx]
    setTimeLeft(q.time_seconds)
    setTimerActive(true)
    setPhase('question')
  }, [questionIndex, quiz, id])

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Setting up the live session...</p>
      </div>
    )
  }

  if (error || !session || !quiz) {
    return (
      <div style={{ height: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#E05C4B', fontSize: 15 }}>{error ?? 'Session not found.'}</p>
      </div>
    )
  }

  const currentQ: QuizQuestion | undefined = quiz.questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Lobby */}
      {phase === 'lobby' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              Join code
            </p>
            <p style={{ fontSize: 72, fontWeight: 700, letterSpacing: '0.15em', color: '#EF9F27', lineHeight: 1 }}>
              {session.join_code}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              Students join at spheresds.app/join
            </p>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '24px 32px',
            minWidth: 320,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, fontWeight: 700, color: '#fff' }}>{participants.length}</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {participants.length === 1 ? 'student waiting' : 'students waiting'}
            </p>
          </div>

          {participants.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 560 }}>
              {participants.map((p) => (
                <div key={p.id} style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                }}>
                  {p.display_name}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={startGame}
            style={{
              background: '#EF9F27',
              border: 'none',
              borderRadius: 12,
              padding: '16px 48px',
              fontSize: 17,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Start game
          </button>
        </div>
      )}

      {/* Question view */}
      {(phase === 'question' || phase === 'reveal') && currentQ && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Question {questionIndex + 1} / {quiz.questions.length}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{quiz.title}</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: `3px solid ${timeLeft <= 5 ? '#E05C4B' : '#EF9F27'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
                color: timeLeft <= 5 ? '#E05C4B' : '#EF9F27',
              }}>
                {phase === 'reveal' ? '0' : timeLeft}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{participants.length} players</p>
              <p style={{ fontSize: 14, color: '#EF9F27', fontWeight: 600 }}>{currentQ.points} pts</p>
            </div>
          </div>

          {/* Question text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', gap: 24 }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '28px 32px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{currentQ.text}</p>
            </div>

            {/* Answer tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {currentQ.options.map((opt) => {
                const isCorrect = opt.label === currentQ.correct
                const revealed = phase === 'reveal'
                return (
                  <div key={opt.label} style={{
                    background: revealed
                      ? isCorrect ? ANSWER_COLORS[opt.label] : 'rgba(255,255,255,0.05)'
                      : ANSWER_COLORS[opt.label],
                    border: `0.5px solid ${revealed && !isCorrect ? 'rgba(255,255,255,0.1)' : ANSWER_COLORS[opt.label]}`,
                    borderRadius: 14,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: revealed && !isCorrect ? 0.4 : 1,
                    transition: 'all 0.3s',
                  }}>
                    <span style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {ANSWER_LABELS[opt.label]}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
                    {revealed && isCorrect && (
                      <span style={{ marginLeft: 'auto', fontSize: 22 }}>✓</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Response heatmap */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 48 }}>
              {currentQ.options.map((opt) => {
                const fakeCount = Math.floor(Math.random() * participants.length + 1)
                const pct = participants.length > 0 ? (fakeCount / participants.length) * 100 : 20
                return (
                  <div key={opt.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', background: `${ANSWER_COLORS[opt.label]}60`, borderRadius: 4, height: `${Math.max(pct, 8)}%`, minHeight: 4 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{opt.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer controls */}
          <div style={{ padding: '20px 32px', borderTop: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
            {phase === 'question' && (
              <button onClick={revealAnswer} style={{
                background: 'rgba(255,255,255,0.1)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}>
                Reveal answer
              </button>
            )}
            {phase === 'reveal' && (
              <button onClick={nextQuestion} style={{
                background: '#EF9F27',
                border: 'none',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}>
                {questionIndex + 1 < quiz.questions.length ? 'Next question' : 'See results'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* End screen */}
      {phase === 'end' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
            Final leaderboard
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 440 }}>
            {sortedParticipants.slice(0, 3).map((p, i) => {
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div key={p.id} style={{
                  background: i === 0 ? 'rgba(239,159,39,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `0.5px solid ${i === 0 ? '#EF9F27' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}>
                  <span style={{ fontSize: 28 }}>{medals[i]}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#fff' }}>{p.display_name}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? '#EF9F27' : 'rgba(255,255,255,0.7)' }}>{p.score}</span>
                </div>
              )
            })}
          </div>
          <a href="/engage" style={{
            marginTop: 16,
            background: 'rgba(255,255,255,0.08)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            textDecoration: 'none',
          }}>
            Back to Engage
          </a>
        </div>
      )}
    </div>
  )
}
