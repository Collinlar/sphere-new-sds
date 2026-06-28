'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EngageSession, Quiz, SessionParticipant, QuizQuestion, EngageTeam } from '@/lib/types'
import { ensureTeamsForSession, scoreTeamQuestion } from '@/lib/engage-team-service'
import { TeamHostFinal, TeamHostLobby, TeamHostScores } from '@/components/engage/TeamHostSections'

const ANSWER_COLORS: Record<string, string> = { A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010' }
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
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({})
  const [answeredCount, setAnsweredCount] = useState(0)
  const [teams, setTeams] = useState<EngageTeam[]>([])

  const isTeamMode = (session?.settings as { game_mode?: string })?.game_mode === 'team'

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
      const settings = (data as EngageSession).settings as { game_mode?: string }
      if (settings?.game_mode === 'team') {
        const teamRows = await ensureTeamsForSession(id)
        setTeams(teamRows)
      }
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
    if (!id || (phase !== 'question' && phase !== 'reveal')) return

    async function loadResponses() {
      const { data } = await supabase
        .from('session_responses')
        .select('answer')
        .eq('session_id', id)
        .eq('question_index', questionIndex)

      const counts: Record<string, number> = {}
      for (const r of data ?? []) {
        if (r.answer) counts[r.answer] = (counts[r.answer] ?? 0) + 1
      }
      setResponseCounts(counts)
      setAnsweredCount(data?.length ?? 0)
    }

    loadResponses()
    const interval = setInterval(loadResponses, 2000)
    return () => clearInterval(interval)
  }, [id, questionIndex, phase])

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

  const timePerQuestion = (session?.settings as { time_per_question?: number } | undefined)?.time_per_question

  const startGame = useCallback(async () => {
    await supabase.from('engage_sessions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id)
    const q = quiz?.questions[0]
    if (q) {
      setTimeLeft(timePerQuestion ?? q.time_seconds)
      setTimerActive(true)
    }
    setPhase('question')
    setQuestionIndex(0)
  }, [id, quiz, timePerQuestion])

  const revealAnswer = useCallback(async () => {
    setTimerActive(false)
    setPhase('reveal')
    if (isTeamMode && quiz && teams.length > 0) {
      const q = quiz.questions[questionIndex]
      const settings = session?.settings as { consensus_bonus?: boolean }
      for (const team of teams) {
        const members = participants.filter(p => p.team_id === team.id)
        await scoreTeamQuestion(
          id,
          team.id,
          questionIndex,
          q.correct,
          q.points,
          settings?.consensus_bonus ?? true,
          members.length,
        )
      }
      const refreshed = await ensureTeamsForSession(id)
      setTeams(refreshed)
    }
  }, [isTeamMode, quiz, teams, questionIndex, session, participants, id])

  const nextQuestion = useCallback(async () => {
    const nextIdx = questionIndex + 1
    if (!quiz || nextIdx >= quiz.questions.length) {
      setPhase('end')
      supabase.from('engage_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id)
      return
    }
    setQuestionIndex(nextIdx)
    await supabase.from('engage_sessions').update({ current_question_index: nextIdx }).eq('id', id)
    const q = quiz.questions[nextIdx]
    setTimeLeft(timePerQuestion ?? q.time_seconds)
    setTimerActive(true)
    setPhase('question')
  }, [questionIndex, quiz, id, timePerQuestion])

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Setting up the live session...</p>
      </div>
    )
  }

  if (error || !session || !quiz) {
    return (
      <div style={{ height: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#C23B2A', fontSize: 15 }}>{error ?? 'Session not found.'}</p>
      </div>
    )
  }

  const currentQ: QuizQuestion | undefined = quiz.questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div style={{ minHeight: '100vh', background: '#0C1021', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Lobby */}
      {phase === 'lobby' && isTeamMode && (
        <TeamHostLobby
          joinCode={session.join_code}
          teams={teams}
          participants={participants}
          onStart={startGame}
        />
      )}

      {phase === 'lobby' && !isTeamMode && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
              Students: go to spheresds.app/join
            </p>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 44px', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Game code</span>
              <span style={{ fontSize: 50, fontWeight: 900, letterSpacing: '0.14em', color: '#fff', lineHeight: 1.05 }}>{session.join_code}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A8966' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {participants.length} joined
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Waiting for more...</span>
          </div>

          {participants.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560 }}>
              {participants.map((p) => (
                <span key={p.id} style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                }}>
                  {p.display_name}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={startGame}
            style={{
              background: '#D97010',
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
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
              Question {questionIndex + 1} of {quiz.questions.length}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A8966' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{answeredCount} of {participants.length} answered</span>
              </div>
              <div style={{ background: '#D97010', borderRadius: 8, padding: '8px 22px' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                  0:{(phase === 'reveal' ? 0 : timeLeft).toString().padStart(2, '0')}
                </span>
              </div>
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

            {/* Live answer distribution */}
            {isTeamMode && phase === 'reveal' && (
              <TeamHostScores
                teams={teams}
                questionLabel={`Q${questionIndex + 1} of ${quiz.questions.length}`}
                correctLabel={`${currentQ.correct}. ${currentQ.options.find(o => o.label === currentQ.correct)?.text ?? ''}`}
              />
            )}
            {!isTeamMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt) => {
                const count = responseCounts[opt.label] ?? 0
                const pct = answeredCount > 0 ? (count / answeredCount) * 100 : 0
                return (
                  <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 8,
                      background: ANSWER_COLORS[opt.label], color: '#fff',
                      fontSize: 15, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {opt.label}
                    </span>
                    <div style={{ flex: 1, position: 'relative', height: 38, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, height: '100%', background: ANSWER_COLORS[opt.label], opacity: 0.75, borderRadius: 8, transition: 'width 0.4s' }} />
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', width: 30, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                )
              })}
            </div>
            )}
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
                background: '#D97010',
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
      {phase === 'end' && isTeamMode && <TeamHostFinal teams={teams} />}

      {phase === 'end' && !isTeamMode && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
            Final leaderboard
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 440 }}>
            {sortedParticipants.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{
                background: i === 0 ? 'rgba(239,159,39,0.15)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${i === 0 ? '#D97010' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? '#D97010' : 'rgba(255,255,255,0.4)', width: 24 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#fff' }}>{p.display_name}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? '#D97010' : 'rgba(255,255,255,0.7)' }}>{p.score}</span>
              </div>
            ))}
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
