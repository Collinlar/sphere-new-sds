'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EngageSession, EngageTeam, Quiz, QuizQuestion } from '@/lib/types'
import { assignParticipantToTeam } from '@/lib/engage-team-service'
import { StudentTeamDiscuss, StudentTeamFinal, StudentTeamLobby, StudentTeamResult } from '@/components/engage/StudentTeamGame'
import { IconCheck } from '@/components/icons'
import GuestClaimBanner from '@/components/brand/GuestClaimBanner'

const ANSWER_COLORS: Record<string, string> = { A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010' }

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
  const [consensusBonus, setConsensusBonus] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<EngageTeam | null>(null)
  const [teams, setTeams] = useState<EngageTeam[]>([])
  const [discussTimeLeft, setDiscussTimeLeft] = useState(30)
  const [teamLocked, setTeamLocked] = useState(false)

  const isTeamMode = (session?.settings as { game_mode?: string })?.game_mode === 'team'

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
      setTeamLocked(false)
      const secs = (session?.settings as { discussion_seconds?: number })?.discussion_seconds ?? 30
      setDiscussTimeLeft(secs)
      setPhase('question')
    } else if (data.status === 'active' && phase === 'result') {
      const newIdx = data.current_question_index ?? 0
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx)
        setSelectedAnswer(null)
        setWasCorrect(null)
        setTeamLocked(false)
        const secs = (session?.settings as { discussion_seconds?: number })?.discussion_seconds ?? 30
        setDiscussTimeLeft(secs)
        setPhase('question')
      }
    } else if (data.status === 'ended') {
      if (isTeamMode) {
        const { data: teamData } = await supabase.from('engage_teams').select('*').eq('session_id', sessionId)
        setTeams((teamData ?? []) as EngageTeam[])
      }
      setPhase('final')
    }
  }, [phase, currentIndex, session, isTeamMode])

  useEffect(() => {
    if (!session || phase === 'join' || phase === 'final') return
    const interval = setInterval(() => pollSession(session.id), 2000)
    return () => clearInterval(interval)
  }, [session, phase, pollSession])

  useEffect(() => {
    if (!isTeamMode || phase !== 'question' || teamLocked) return
    if (discussTimeLeft <= 0) return
    const t = setTimeout(() => setDiscussTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [discussTimeLeft, phase, teamLocked, isTeamMode])

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

    const settings = sessionData.settings as { game_mode?: string }
    let assignedTeam: EngageTeam | null = null
    if (settings?.game_mode === 'team') {
      assignedTeam = await assignParticipantToTeam(sessionData.id, participant.id)
      setTeam(assignedTeam)
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
    setTotalScore(prev => prev + pts)

    await supabase.from('session_participants').update({ score: totalScore + pts }).eq('id', participantId)
    await supabase.from('session_responses').insert({
      session_id: session.id,
      participant_id: participantId,
      question_index: currentIndex,
      answer: label,
      is_correct: correct,
      points_earned: pts,
    })

    setTimeout(() => setPhase('result'), 1200)
  }

  async function handleTeamVote(label: string) {
    if (!participantId || !session || !team) return
    await supabase.from('session_participants').update({ team_vote: label }).eq('id', participantId)
    setTeamLocked(true)
    setSelectedAnswer(label)
    setTimeout(() => setPhase('result'), 1500)
  }

  async function loadTeamResult() {
    if (!team || !quiz) return
    const q = quiz.questions[currentIndex]
    const { data: teamRow } = await supabase.from('engage_teams').select('score').eq('id', team.id).single()
    if (teamRow) setTotalScore(teamRow.score)
    const correct = selectedAnswer === q.correct
    setWasCorrect(correct)
    const bonus = correct && (session?.settings as { consensus_bonus?: boolean })?.consensus_bonus ? 50 : 0
    setConsensusBonus(bonus)
    setPointsEarned(correct ? q.points : 0)
  }

  useEffect(() => {
    if (phase === 'result' && isTeamMode && team) loadTeamResult()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isTeamMode, team?.id])

  const currentQ: QuizQuestion | undefined = quiz?.questions[currentIndex]
  const darkBg = phase !== 'join' && (isTeamMode || phase !== 'lobby')

  return (
    <div style={{
      minHeight: '100vh',
      background: phase === 'join' || (phase === 'lobby' && !isTeamMode) ? 'var(--page-bg)' : '#0C1021',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'var(--font)',
      maxWidth: 480,
      margin: '0 auto',
    }}>

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
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="What's your name?"
            maxLength={30}
            style={{
              width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 12,
              padding: '16px 18px', fontSize: 18, color: 'var(--near-black)', fontFamily: 'inherit',
              textAlign: 'center', boxSizing: 'border-box', marginBottom: 14, minHeight: 56,
            }}
          />
          {error && <p style={{ color: '#C23B2A', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              width: '100%', background: '#D97010', border: 'none', borderRadius: 12,
              padding: '16px', fontSize: 17, fontWeight: 700, color: '#fff',
              cursor: joining ? 'wait' : 'pointer', minHeight: 56, fontFamily: 'inherit',
            }}
          >
            {joining ? 'Joining...' : 'Join game'}
          </button>
        </div>
      )}

      {phase === 'lobby' && isTeamMode && team && session && participantId && (
        <StudentTeamLobby
          sessionId={session.id}
          team={team}
          participantId={participantId}
          participantName={name}
          code={code ?? ''}
        />
      )}

      {phase === 'lobby' && !isTeamMode && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#D97010', color: '#fff',
            fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>{name}</p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 32 }}>
            You&apos;re in! Waiting for the teacher to start the game.
          </p>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 32px' }}>
            <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--near-black)' }}>{participantCount}</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 4 }}>
              {participantCount === 1 ? 'player' : 'players'} in the lobby
            </p>
          </div>
        </div>
      )}

      {phase === 'question' && currentQ && isTeamMode && team && session && participantId && (
        <StudentTeamDiscuss
          sessionId={session.id}
          team={team}
          participantId={participantId}
          participantName={name}
          code={code ?? ''}
          questionText={currentQ.text}
          options={currentQ.options}
          questionIndex={currentIndex}
          totalQuestions={quiz?.questions.length ?? 0}
          timeLeft={discussTimeLeft}
          onLock={handleTeamVote}
        />
      )}

      {phase === 'question' && currentQ && !isTeamMode && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Q{currentIndex + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D97010' }}>{currentQ.points} pts</span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '22px 20px', marginBottom: 20, textAlign: 'center',
          }}>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{currentQ.text}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentQ.options.map(opt => (
              <button
                key={opt.label}
                onClick={() => handleAnswer(opt.label)}
                disabled={!!selectedAnswer}
                style={{
                  width: '100%',
                  background: selectedAnswer === opt.label ? ANSWER_COLORS[opt.label] : `${ANSWER_COLORS[opt.label]}CC`,
                  border: 'none', borderRadius: 12, padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: selectedAnswer ? 'default' : 'pointer',
                  opacity: selectedAnswer && selectedAnswer !== opt.label ? 0.5 : 1,
                  minHeight: 64, textAlign: 'left',
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.25)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{opt.label}</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && isTeamMode && team && (
        <StudentTeamResult
          team={team}
          correct={!!wasCorrect}
          points={pointsEarned}
          consensusBonus={consensusBonus}
          teamTotal={totalScore}
        />
      )}

      {phase === 'result' && !isTeamMode && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: wasCorrect ? '#1A8966' : '#C23B2A', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
          }}>
            {wasCorrect ? <IconCheck size={44} /> : <span style={{ fontSize: 32, fontWeight: 700 }}>✕</span>}
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {wasCorrect ? 'Correct!' : 'Wrong answer'}
          </p>
          {wasCorrect && <p style={{ fontSize: 32, fontWeight: 700, color: '#D97010' }}>+{pointsEarned} pts</p>}
          <p style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Waiting for the next question...</p>
        </div>
      )}

      {phase === 'final' && isTeamMode && team && (
        <StudentTeamFinal teams={teams.length ? teams : [team]} myTeamId={team.id} />
      )}

      {phase === 'final' && !isTeamMode && (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--amber-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            color: 'var(--amber)',
          }}>
            <IconCheck size={36} />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Game over!</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Great job, {name}.</p>
          <div style={{
            background: 'rgba(239,159,39,0.15)', border: '0.5px solid #D97010',
            borderRadius: 16, padding: '28px 40px', marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your final score</p>
            <p style={{ fontSize: 52, fontWeight: 700, color: '#D97010' }}>{totalScore}</p>
          </div>
          {participantId && <GuestClaimBanner sessionType="engage" submissionId={participantId} />}
        </div>
      )}
    </div>
  )
}
