'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EngageSession, Quiz, QuizQuestion } from '@/lib/types'

const ANSWER_COLORS: Record<string, string> = { A: '#36318F', B: '#2BA888', C: '#E05C4B', D: '#EF9F27' }

type StudentPhase = 'join' | 'lobby' | 'question' | 'result' | 'final'

export default function StudentEngageGame() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<StudentPhase>('join')
  const [name, setName] = useState('')
  const [session, setSession] = useState<EngageSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll for session status
  const pollSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('engage_sessions')
      .select('status, current_question_index')
      .eq('id', sessionId)
      .single()

    if (!data) return

    if (data.status === 'active' && phase === 'lobby') {
      setCurrentIndex(data.current_question_index ?? 0)
      setSelectedAnswer(null)
      setWasCorrect(null)
      setPhase('question')
    } else if (data.status === 'active' && phase === 'result') {
      const newIdx = data.current_question_index ?? 0
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx)
        setSelectedAnswer(null)
        setWasCorrect(null)
        setPhase('question')
      }
    } else if (data.status === 'ended') {
      setPhase('final')
    }
  }, [phase, currentIndex])

  useEffect(() => {
    if (!session || phase === 'join' || phase === 'final') return
    const interval = setInterval(() => pollSession(session.id), 2000)
    return () => clearInterval(interval)
  }, [session, phase, pollSession])

  async function handleJoin() {
    if (!name.trim()) {
      setError('Tell us your name first.')
      return
    }
    setJoining(true)
    setError(null)

    const { data: sessionData } = await supabase
      .from('engage_sessions')
      .select('*, quizzes(*)')
      .eq('join_code', code.toUpperCase())
      .neq('status', 'ended')
      .single()

    if (!sessionData) {
      setError('That code does not match an active game. Double-check with your teacher.')
      setJoining(false)
      return
    }

    const { data: participant, error: pErr } = await supabase
      .from('session_participants')
      .insert({
        session_id: sessionData.id,
        display_name: name.trim(),
        score: 0,
        streak: 0,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (pErr || !participant) {
      setError('Could not join the game. Try again in a moment.')
      setJoining(false)
      return
    }

    setSession(sessionData as EngageSession)
    setQuiz((sessionData as { quizzes: Quiz }).quizzes)
    setParticipantId(participant.id)
    setJoining(false)

    const { count } = await supabase
      .from('session_participants')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionData.id)
    setParticipantCount(count ?? 1)

    setPhase('lobby')
  }

  async function handleAnswer(label: string) {
    if (selectedAnswer || !quiz || !session || !participantId) return

    const q: QuizQuestion = quiz.questions[currentIndex]
    const correct = q.correct === label
    const pts = correct ? q.points : 0

    setSelectedAnswer(label)
    setWasCorrect(correct)
    setPointsEarned(pts)
    setTotalScore((prev) => prev + pts)

    await supabase.from('session_participants').update({ score: totalScore + pts }).eq('id', participantId)

    setTimeout(() => setPhase('result'), 1200)
  }

  const currentQ: QuizQuestion | undefined = quiz?.questions[currentIndex]

  return (
    <div style={{
      minHeight: '100vh',
      background: phase === 'join' || phase === 'lobby' ? 'var(--page-bg)' : '#0A0E1A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* JOIN */}
      {phase === 'join' && (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--mid-grey)', marginBottom: 8 }}>
            Game code: {code?.toUpperCase()}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--near-black)', marginBottom: 32, lineHeight: 1.2 }}>
            Ready to play?
          </h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="What's your name?"
            maxLength={30}
            style={{
              width: '100%',
              background: 'var(--bg2)',
              border: 'none',
              borderRadius: 12,
              padding: '16px 18px',
              fontSize: 18,
              color: 'var(--near-black)',
              fontFamily: 'inherit',
              textAlign: 'center',
              boxSizing: 'border-box',
              marginBottom: 14,
              minHeight: 56,
            }}
          />
          {error && (
            <p style={{ color: '#E05C4B', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              width: '100%',
              background: '#EF9F27',
              border: 'none',
              borderRadius: 12,
              padding: '16px',
              fontSize: 17,
              fontWeight: 700,
              color: '#fff',
              cursor: joining ? 'wait' : 'pointer',
              minHeight: 56,
            }}
          >
            {joining ? 'Joining...' : 'Join game'}
          </button>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#EF9F27',
            color: '#fff',
            fontSize: 28,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>{name}</p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 32 }}>
            You&apos;re in! Waiting for the teacher to start the game.
          </p>
          <div style={{
            background: 'var(--white)',
            border: '0.5px solid var(--border)',
            borderRadius: 12,
            padding: '20px 32px',
          }}>
            <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--near-black)' }}>{participantCount}</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 4 }}>
              {participantCount === 1 ? 'player' : 'players'} in the lobby
            </p>
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#EF9F27',
                opacity: 0.3 + (i * 0.35),
                animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* QUESTION */}
      {phase === 'question' && currentQ && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Q{currentIndex + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#EF9F27' }}>{currentQ.points} pts</span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '22px 20px',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{currentQ.text}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentQ.options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleAnswer(opt.label)}
                disabled={!!selectedAnswer}
                style={{
                  width: '100%',
                  background: selectedAnswer === opt.label
                    ? ANSWER_COLORS[opt.label]
                    : `${ANSWER_COLORS[opt.label]}CC`,
                  border: 'none',
                  borderRadius: 12,
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: selectedAnswer ? 'default' : 'pointer',
                  opacity: selectedAnswer && selectedAnswer !== opt.label ? 0.5 : 1,
                  transition: 'all 0.2s',
                  minHeight: 64,
                  textAlign: 'left',
                }}
              >
                <span style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULT */}
      {phase === 'result' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: wasCorrect ? '#2BA888' : '#E05C4B',
            color: '#fff',
            fontSize: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            {wasCorrect ? '✓' : '✗'}
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {wasCorrect ? 'Correct!' : 'Wrong answer'}
          </p>
          {wasCorrect && (
            <p style={{ fontSize: 32, fontWeight: 700, color: '#EF9F27' }}>+{pointsEarned} pts</p>
          )}
          {!wasCorrect && currentQ && (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
              The correct answer was {currentQ.correct}
            </p>
          )}
          <div style={{
            marginTop: 28,
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '16px 24px',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total score</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{totalScore}</p>
          </div>
          <p style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Waiting for the next question...</p>
        </div>
      )}

      {/* FINAL */}
      {phase === 'final' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🎉</p>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Game over!</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Great job, {name}.</p>
          <div style={{
            background: 'rgba(239,159,39,0.15)',
            border: '0.5px solid #EF9F27',
            borderRadius: 16,
            padding: '28px 40px',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your final score</p>
            <p style={{ fontSize: 52, fontWeight: 700, color: '#EF9F27' }}>{totalScore}</p>
          </div>
        </div>
      )}
    </div>
  )
}
