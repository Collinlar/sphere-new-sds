'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EngageSession, EngageTeam, Quiz, QuizQuestion, SessionParticipant } from '@/lib/types'
import { assignParticipantToTeam } from '@/lib/engage-team-service'
import { StudentTeamDiscuss, StudentTeamFinal, StudentTeamLobby, StudentTeamResult } from '@/components/engage/StudentTeamGame'
import { IconCheck } from '@/components/icons'
import GuestClaimBanner from '@/components/brand/GuestClaimBanner'
import AnswerSurface from '@/components/engage/AnswerSurface'
import SplitCoOpAnswer from '@/components/engage/SplitCoOpAnswer'
import { dealOptions } from '@/lib/engage-split'
import { usesTeams, isSplitCoOp } from '@/lib/engage-teams'
import { resolveJoinIdentity } from '@/lib/join-identity'
import { saveEngageSeat, readEngageSeat, clearEngageSeat, type EngageSeat } from '@/lib/engage-rejoin'
import {
  checkAnswer,
  computeScore,
  scoringModelFromSettings,
  SCORING_PRESETS,
  type ScoreResult,
} from '@/lib/engage-scoring'

const ANSWER_COLORS: Record<string, string> = { A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010' }

type StudentPhase = 'join' | 'lobby' | 'question' | 'result' | 'final'

/** The columns a seat is restored or reused from. */
interface SeatRow {
  id: string
  score?: number
  streak?: number
  team_id?: string | null
}

export default function StudentEngageGame() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<StudentPhase>('join')
  const [name, setName] = useState('')
  const [session, setSession] = useState<EngageSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  // True while we check for a saved seat, so the join screen never flashes
  // in front of a player who is already in the game.
  const [restoring, setRestoring] = useState(true)
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
  const [signedIn, setSignedIn] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountUserId, setAccountUserId] = useState<string | null>(null)
  const [useCustomName, setUseCustomName] = useState(false)
  const [identityReady, setIdentityReady] = useState(false)
  const [leaderboard, setLeaderboard] = useState<SessionParticipant[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)

  const [streak, setStreak] = useState(0)
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreResult | null>(null)
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])

  const phaseRef = useRef(phase)
  const indexRef = useRef(currentIndex)
  const sessionRef = useRef(session)
  // Host clock anchor and scoring rules, refreshed on every sync tick.
  const questionStartedAtRef = useRef<number | null>(null)
  const scoringModelRef = useRef(SCORING_PRESETS.balanced.model)
  phaseRef.current = phase
  indexRef.current = currentIndex
  sessionRef.current = session

  const engageMode = (session?.settings as { game_mode?: string })?.game_mode
  // Co-op runs on the team machinery: teams, votes and team scoring are all
  // shared. The only difference is that each member sees a slice of the
  // options rather than all of them.
  const isCoOp = isSplitCoOp(engageMode)
  const isTeamMode = usesTeams(engageMode)

  // Which options this player holds. Derived identically on every device from
  // the session, question and sorted member list, so teammates never disagree
  // about who is holding what.
  const currentQuestion = quiz?.questions[currentIndex]
  const myCoOpLabels =
    isCoOp && session && currentQuestion && participantId && teamMemberIds.length > 0
      ? dealOptions({
          sessionId: session.id,
          questionIndex: currentIndex,
          memberIds: teamMemberIds,
          question: currentQuestion,
        }).byMember[participantId] ?? []
      : []


  useEffect(() => {
    let cancelled = false
    resolveJoinIdentity().then((identity) => {
      if (cancelled) return
      setSignedIn(identity.signedIn)
      setAccountName(identity.accountName)
      setAccountUserId(identity.userId)
      if (identity.signedIn && identity.accountName) {
        setName(identity.accountName)
        setUseCustomName(false)
      }
      setIdentityReady(true)
    })
    return () => { cancelled = true }
  }, [])

  // If a player is already in-session without quiz content (RLS miss), pull it via API
  useEffect(() => {
    if (!code || quiz || phase === 'join') return
    let cancelled = false
    async function recover() {
      const res = await fetch(`/api/engage/playable?code=${encodeURIComponent(code.toUpperCase())}`)
      const body = await res.json().catch(() => ({}))
      if (cancelled || !res.ok || !body.quiz) return
      const q = body.quiz as Quiz
      setQuiz({ ...q, questions: Array.isArray(q.questions) ? q.questions : [] })
    }
    void recover()
    return () => { cancelled = true }
  }, [code, quiz, phase])

  const resetForQuestion = useCallback((idx: number, discussionSeconds: number) => {
    setCurrentIndex(idx)
    setSelectedAnswer(null)
    setWasCorrect(null)
    setTeamLocked(false)
    setDiscussTimeLeft(discussionSeconds)
    setPhase('question')
  }, [])

  // Take the player back to their seat after a reload or a dropped signal.
  // Runs once, before the join screen is offered, and only trusts a stored
  // seat that still exists in the database.
  useEffect(() => {
    if (!code) { setRestoring(false); return }
    const seat = readEngageSeat(code)
    if (!seat) { setRestoring(false); return }

    let cancelled = false
    async function restore(saved: EngageSeat) {
      try {
        const { data: participant } = await supabase
          .from('session_participants')
          .select('id, display_name, score, streak, team_id')
          .eq('id', saved.participantId)
          .maybeSingle()

        // Seat is gone (host cleared the room, or a different game reused
        // the code). Forget it and let them join normally.
        if (!participant) {
          clearEngageSeat(code!)
          if (!cancelled) setRestoring(false)
          return
        }

        const res = await fetch(`/api/engage/playable?code=${encodeURIComponent(code!.toUpperCase())}`)
        const body = await res.json().catch(() => null)

        // The playable endpoint refuses finished games, which is right for
        // joining but wrong for coming back. A player who reloads after the
        // final whistle should see their result, not be asked to rejoin a
        // game that is over.
        if (!res.ok || !body?.session || !body?.quiz) {
          const { data: endedSession } = await supabase
            .from('engage_sessions')
            .select('*')
            .eq('id', saved.sessionId)
            .maybeSingle()
          if (endedSession && (endedSession as EngageSession).status === 'ended' && !cancelled) {
            setSession(endedSession as EngageSession)
            setParticipantId(participant.id as string)
            setName((participant.display_name as string) ?? saved.displayName)
            setTotalScore(Number(participant.score ?? 0))
            setStreak(Number(participant.streak ?? 0))
            // The team results screen needs the team, so bring it back too.
            if (participant.team_id) {
              const { data: teamRow } = await supabase
                .from('engage_teams')
                .select('*')
                .eq('id', participant.team_id as string)
                .maybeSingle()
              if (teamRow && !cancelled) setTeam(teamRow as EngageTeam)
            }
            if (!cancelled) setPhase('final')
          }
          if (!cancelled) setRestoring(false)
          return
        }

        const sessionData = body.session as EngageSession
        if (sessionData.id !== saved.sessionId) {
          clearEngageSeat(code!)
          if (!cancelled) setRestoring(false)
          return
        }

        const quizData = body.quiz as Quiz
        const questions = Array.isArray(quizData.questions) ? quizData.questions : []
        if (cancelled) return

        setSession(sessionData)
        setQuiz({ ...quizData, questions })
        setParticipantId(participant.id as string)
        setName((participant.display_name as string) ?? saved.displayName)
        // Their score and run come back with them.
        setTotalScore(Number(participant.score ?? 0))
        setStreak(Number(participant.streak ?? 0))

        if (participant.team_id) {
          const { data: teamRow } = await supabase
            .from('engage_teams')
            .select('*')
            .eq('id', participant.team_id as string)
            .maybeSingle()
          if (teamRow && !cancelled) setTeam(teamRow as EngageTeam)
        }

        if (cancelled) return
        if (sessionData.status === 'ended') {
          setPhase('final')
        } else if (sessionData.status === 'active') {
          const secs = (sessionData.settings as { discussion_seconds?: number })?.discussion_seconds ?? 30
          resetForQuestion(sessionData.current_question_index ?? 0, secs)
        } else {
          setPhase('lobby')
        }
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    void restore(seat)
    return () => { cancelled = true }
  }, [code, resetForQuestion])

  // If a player is already in-session without quiz content (RLS miss), pull it via API
  useEffect(() => {
    if (!code || quiz || phase === 'join') return
    let cancelled = false
    async function recover() {
      const res = await fetch(`/api/engage/playable?code=${encodeURIComponent(code.toUpperCase())}`)
      const body = await res.json().catch(() => ({}))
      if (cancelled || !res.ok || !body.quiz) return
      const q = body.quiz as Quiz
      setQuiz({ ...q, questions: Array.isArray(q.questions) ? q.questions : [] })
    }
    void recover()
    return () => { cancelled = true }
  }, [code, quiz, phase])

  useEffect(() => {
    if (!session) return

    async function tick() {
      const currentPhase = phaseRef.current
      if (currentPhase === 'join' || currentPhase === 'final') return

      const { data } = await supabase
        .from('engage_sessions')
        .select('status, current_question_index, settings, question_started_at')
        .eq('id', session!.id)
        .single()

      if (!data) return

      const settings = (data.settings ?? {}) as { discussion_seconds?: number; game_mode?: string }
      const discussionSeconds = settings.discussion_seconds ?? 30
      const newIdx = data.current_question_index ?? 0

      // Everyone times against the host's clock, so a slow phone or a late
      // render never costs a student points.
      if (data.question_started_at) {
        questionStartedAtRef.current = new Date(data.question_started_at as string).getTime()
      }
      scoringModelRef.current = scoringModelFromSettings(data.settings)

      if (data.status === 'ended') {
        if (usesTeams(settings.game_mode)) {
          const { data: teamData } = await supabase.from('engage_teams').select('*').eq('session_id', session!.id)
          setTeams((teamData ?? []) as EngageTeam[])
        } else {
          const { data: ranks } = await supabase
            .from('session_participants')
            .select('*')
            .eq('session_id', session!.id)
            .order('score', { ascending: false })
          const rows = (ranks ?? []) as SessionParticipant[]
          setLeaderboard(rows)
          if (participantId) {
            const idx = rows.findIndex((p) => p.id === participantId)
            setMyRank(idx >= 0 ? idx + 1 : null)
            const me = rows.find((p) => p.id === participantId)
            if (me) setTotalScore(me.score)
          }
        }
        setPhase('final')
        return
      }

      if (data.status === 'active') {
        const prevPhase = phaseRef.current
        const prevIdx = indexRef.current
        if (prevPhase === 'lobby') {
          resetForQuestion(newIdx, discussionSeconds)
        } else if ((prevPhase === 'result' || prevPhase === 'question') && newIdx !== prevIdx) {
          resetForQuestion(newIdx, discussionSeconds)
        } else if (prevPhase === 'question' && newIdx === prevIdx) {
          // stay on current question
        }
      }

      if (phaseRef.current === 'lobby') {
        const { count } = await supabase
          .from('session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session!.id)
        setParticipantCount(count ?? 0)
      }
    }

    void tick()
    const interval = setInterval(() => { void tick() }, 1500)
    return () => clearInterval(interval)
  }, [session?.id, participantId, resetForQuestion])

  // Co-op needs the roster of this team to work out the deal. Refreshed as
  // the question changes so a latecomer is included from their first question.
  useEffect(() => {
    if (!isTeamMode || !session || !team) return
    let cancelled = false
    supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('team_id', team.id)
      .then(({ data }) => {
        if (!cancelled) setTeamMemberIds((data ?? []).map(r => r.id as string))
      })
    return () => { cancelled = true }
  }, [isTeamMode, session?.id, team?.id, currentIndex])

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

    // Load session + quiz via service route so unpublished quizzes are
    // playable for guests and players outside the host institution.
    const playableRes = await fetch(`/api/engage/playable?code=${encodeURIComponent(code.toUpperCase())}`)
    const playableBody = await playableRes.json().catch(() => ({}))
    if (!playableRes.ok || !playableBody.session || !playableBody.quiz) {
      setError(playableBody.error ?? 'That code does not match an active game. Double-check with your teacher.')
      setJoining(false)
      return
    }

    const sessionData = playableBody.session as EngageSession & { quizzes?: Quiz }
    const quizData = playableBody.quiz as Quiz
    const questions = Array.isArray(quizData.questions) ? quizData.questions : []
    if (questions.length === 0) {
      setError('This game has no questions yet. Ask the host to add questions and start again.')
      setJoining(false)
      return
    }

    // A signed-in player who rejoins takes their existing seat rather than
    // making a second one. This is the fallback when localStorage is not
    // available, such as private browsing or a different device.
    let participant: SeatRow | null = null
    if (accountUserId) {
      const { data: existing } = await supabase
        .from('session_participants')
        .select('id, score, streak, team_id')
        .eq('session_id', sessionData.id)
        .eq('user_id', accountUserId)
        .maybeSingle()
      if (existing) participant = existing as SeatRow
    }

    if (!participant) {
      // The room cap only applies to new seats. Someone returning to a seat
      // they already hold is not a new player, and turning them away would
      // lock them out of their own game.
      const { checkEngageSessionJoin } = await import('@/lib/session-limits')
      const joinCheck = await checkEngageSessionJoin(sessionData.id)
      if (!joinCheck.allowed) {
        setError(joinCheck.reason ?? 'This session is full.')
        setJoining(false)
        return
      }

      const insertPayload: Record<string, unknown> = {
        session_id: sessionData.id,
        display_name: name.trim(),
        score: 0,
        streak: 0,
        joined_at: new Date().toISOString(),
      }
      if (accountUserId && !useCustomName) {
        insertPayload.user_id = accountUserId
      }

      const { data: created, error: pErr } = await supabase
        .from('session_participants')
        .insert(insertPayload)
        .select()
        .single()

      if (pErr || !created) {
        setError('Could not join the game. Try again in a moment.')
        setJoining(false)
        return
      }
      participant = created as SeatRow
    } else {
      // Returning to an existing seat brings the score and run back with it.
      setTotalScore(Number(participant.score ?? 0))
      setStreak(Number(participant.streak ?? 0))
    }

    const settings = sessionData.settings as { game_mode?: string }
    let assignedTeam: EngageTeam | null = null
    if (usesTeams(settings?.game_mode)) {
      if (participant.team_id) {
        // Already has a team. Keep them with their teammates.
        const { data: existingTeam } = await supabase
          .from('engage_teams')
          .select('*')
          .eq('id', participant.team_id)
          .maybeSingle()
        assignedTeam = (existingTeam as EngageTeam | null) ?? null
      }
      if (!assignedTeam) {
        assignedTeam = await assignParticipantToTeam(sessionData.id, participant.id)
      }
      setTeam(assignedTeam)
    }

    setSession(sessionData as EngageSession)
    setQuiz({ ...quizData, questions })
    setParticipantId(participant.id)
    // Remember the seat so a reload or a dropped connection returns the
    // player to their game instead of creating a second participant.
    saveEngageSeat(code ?? '', {
      participantId: participant.id,
      sessionId: sessionData.id,
      displayName: name.trim(),
    })
    setJoining(false)

    const { count } = await supabase
      .from('session_participants')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionData.id)
    setParticipantCount(count ?? 1)

    if (sessionData.status === 'active') {
      const secs = (sessionData.settings as { discussion_seconds?: number })?.discussion_seconds ?? 30
      resetForQuestion(sessionData.current_question_index ?? 0, secs)
    } else {
      setPhase('lobby')
    }
  }

  async function handleAnswer(label: string) {
    if (selectedAnswer || !quiz || !session || !participantId) return

    const q: QuizQuestion = quiz.questions[currentIndex]
    const check = checkAnswer(q, label)

    // Time from the host's question_started_at, clamped to the question's
    // own window so clock skew or a late write cannot mint points.
    const startedAt = questionStartedAtRef.current
    const limitMs = Math.max(1, (q.time_seconds || 20) * 1000)
    const elapsedMs = startedAt ? Date.now() - startedAt : limitMs

    // Fastest finger needs to know whether anyone has already got it right.
    let isFirstCorrect = false
    const model = scoringModelRef.current
    if (check.correct && !check.unscored && model.fastestFinger) {
      const { count } = await supabase
        .from('session_responses')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('question_index', currentIndex)
        .eq('is_correct', true)
      isFirstCorrect = (count ?? 0) === 0
    }

    const result = check.unscored
      ? { points: Math.round((q.points || 100) / 2), speedBonus: 0, streakBonus: 0, firstBonus: 0, nextStreak: streak }
      : computeScore({
          correct: check.correct,
          partial: check.partial,
          basePoints: q.points || 100,
          elapsedMs,
          limitMs,
          streak,
          model,
          isFirstCorrect,
          questionIndex: currentIndex,
          totalQuestions: quiz.questions.length,
        })

    const nextScore = totalScore + result.points

    setSelectedAnswer(label)
    setWasCorrect(check.unscored ? null : check.correct)
    setPointsEarned(result.points)
    setScoreBreakdown(result)
    setTotalScore(nextScore)
    setStreak(result.nextStreak)

    await supabase
      .from('session_participants')
      .update({ score: nextScore, streak: result.nextStreak })
      .eq('id', participantId)
    await supabase.from('session_responses').insert({
      session_id: session.id,
      participant_id: participantId,
      question_index: currentIndex,
      answer: label,
      is_correct: check.unscored ? null : check.correct,
      response_time_ms: Math.round(Math.min(elapsedMs, limitMs)),
      points_earned: result.points,
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
    const { data: teamRow } = await supabase
      .from('engage_teams')
      .select('score, streak')
      .eq('id', team.id)
      .single()
    if (teamRow) setTotalScore(Number(teamRow.score ?? 0))

    // Mirror scoreTeamQuestion exactly. This used to compare the answer with
    // `q.correct` and hardcode a 50 point bonus, which was wrong for numeric,
    // ordering and short answer, and drifted from the server once team
    // scoring gained streaks and proportional bonuses. Showing a player a
    // number the host never awards is worse than showing none.
    const check = checkAnswer(q, selectedAnswer)
    const correct = check.correct && !check.unscored
    setWasCorrect(check.unscored ? null : correct)

    const model = scoringModelRef.current
    // Mirrors scoreTeamQuestion, including the poll case: no right answer
    // means participation credit, not a zero and a cross.
    const result = check.unscored
      ? { points: Math.round((q.points || 100) / 2) }
      : computeScore({
          correct,
          partial: check.partial,
          basePoints: q.points || 100,
          elapsedMs: 0,
          limitMs: 1,
          streak: Number(teamRow?.streak ?? 0),
          model: { ...model, speedWeight: 0, fastestFinger: false },
          questionIndex: currentIndex,
          totalQuestions: quiz.questions.length,
        })
    setPointsEarned(result.points)

    // The server only pays a consensus bonus when the team has more than one
    // member, because a team of one cannot reach consensus. Showing it to a
    // solo player promised points that were never awarded.
    const wantsBonus = (session?.settings as { consensus_bonus?: boolean })?.consensus_bonus
    const teamHasMembers = teamMemberIds.length > 1
    setConsensusBonus(
      correct && !check.unscored && wantsBonus && teamHasMembers
        ? Math.round((q.points || 100) * 0.5)
        : 0
    )
  }

  useEffect(() => {
    if (phase === 'result' && isTeamMode && team) loadTeamResult()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isTeamMode, team?.id])

  const currentQ: QuizQuestion | undefined = quiz?.questions[currentIndex]

  if ((!identityReady || restoring) && phase === 'join') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
          {restoring ? 'Finding your game...' : 'Getting your session ready...'}
        </p>
      </div>
    )
  }

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
      width: '100%',
      boxSizing: 'border-box',
    }}>

      {phase === 'join' && (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--mid-grey)', marginBottom: 8 }}>
            Game code: {code?.toUpperCase()}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--near-black)', marginBottom: 24, lineHeight: 1.2 }}>
            Ready to play?
          </h1>

          {signedIn && !useCustomName ? (
            <div style={{ textAlign: 'left', marginBottom: 16 }}>
              <div style={{
                background: 'var(--white)', border: '1.5px solid var(--teal)', borderRadius: 12,
                padding: '16px 18px', marginBottom: 10,
              }}>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 4 }}>Continue as</p>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)' }}>{accountName}</p>
              </div>
              <button
                type="button"
                onClick={() => { setUseCustomName(true); setName('') }}
                style={{
                  background: 'none', border: 'none', padding: 0, fontSize: 13,
                  color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
                }}
              >
                Use a different name
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="What's your name?"
                maxLength={30}
                style={{
                  width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 12,
                  padding: '16px 18px', fontSize: 18, color: 'var(--near-black)', fontFamily: 'inherit',
                  textAlign: 'center', boxSizing: 'border-box', minHeight: 56,
                }}
              />
              {signedIn && useCustomName && (
                <button
                  type="button"
                  onClick={() => { setUseCustomName(false); setName(accountName) }}
                  style={{
                    background: 'none', border: 'none', padding: '10px 0 0', fontSize: 13,
                    color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  Continue as {accountName}
                </button>
              )}
            </div>
          )}

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
            {joining ? 'Joining the game...' : 'Join game'}
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

      {phase === 'lobby' && isTeamMode && !team && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
          Assigning your team...
        </p>
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

      {/* Team modes need a team. If one could not be created the player used
          to get an empty screen with no explanation, which read as the game
          being broken rather than something being wrong behind it. */}
      {phase === 'question' && currentQ && isTeamMode && !team && (
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
            Waiting for your team
          </p>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            We could not put you in a team yet. Hold on a moment, and tell your teacher if this stays on screen.
          </p>
        </div>
      )}

      {phase === 'question' && currentQ && isCoOp && team && session && participantId && (
        <SplitCoOpAnswer
          question={currentQ}
          myLabels={myCoOpLabels}
          locked={teamLocked}
          selected={selectedAnswer}
          onAnswer={handleTeamVote}
        />
      )}

      {phase === 'question' && currentQ && isTeamMode && !isCoOp && team && session && participantId && (
        <StudentTeamDiscuss
          sessionId={session.id}
          team={team}
          participantId={participantId}
          participantName={name}
          code={code ?? ''}
          questionText={currentQ.text}
          options={currentQ.options}
          question={currentQ}
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
          <AnswerSurface
            question={currentQ}
            disabled={!!selectedAnswer}
            selected={selectedAnswer}
            onAnswer={handleAnswer}
          />
        </div>
      )}

      {phase === 'question' && !currentQ && (
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 10, lineHeight: 1.5 }}>
            {quiz ? 'Waiting for the next question...' : 'Loading the questions for this game...'}
          </p>
          {!quiz && (
            <button
              type="button"
              onClick={async () => {
                if (!code) return
                const res = await fetch(`/api/engage/playable?code=${encodeURIComponent(code.toUpperCase())}`)
                const body = await res.json().catch(() => ({}))
                if (res.ok && body.quiz) {
                  const q = body.quiz as Quiz
                  setQuiz({ ...q, questions: Array.isArray(q.questions) ? q.questions : [] })
                } else {
                  setError(body.error ?? 'Could not load the questions. Ask the host to restart.')
                }
              }}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Retry loading questions
            </button>
          )}
          {error && <p style={{ color: '#C23B2A', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {phase === 'result' && isTeamMode && team && (
        <StudentTeamResult
          team={team}
          // Pass null through rather than coercing it. `!!wasCorrect` turned
          // a poll's "no right answer" into "wrong", which is what put a
          // cross and "Not this time" on a question nobody can fail.
          correct={wasCorrect}
          points={pointsEarned}
          consensusBonus={consensusBonus}
          teamTotal={totalScore}
        />
      )}

      {phase === 'result' && !isTeamMode && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            // A poll has no right answer, so it must not be marked in red.
            // wasCorrect is null there, which previously fell through to the
            // wrong-answer styling and told a student they had failed a
            // question that cannot be failed.
            background: wasCorrect === null ? '#2E2886' : wasCorrect ? '#1A8966' : '#C23B2A',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
          }}>
            {wasCorrect === false
              ? <span style={{ fontSize: 32, fontWeight: 700 }}>✕</span>
              : <IconCheck size={44} />}
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {wasCorrect === null ? 'Answer locked in' : wasCorrect ? 'Correct!' : 'Wrong answer'}
          </p>
          {pointsEarned > 0 && <p style={{ fontSize: 32, fontWeight: 700, color: '#D97010' }}>+{pointsEarned} pts</p>}

          {/* Where the points came from, so speed and streaks feel earned. */}
          {scoreBreakdown && pointsEarned > 0 && (scoreBreakdown.streakBonus > 0 || scoreBreakdown.firstBonus > 0 || scoreBreakdown.speedBonus < 0) && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              {scoreBreakdown.firstBonus > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FDE68A', background: 'rgba(232,160,32,0.2)', padding: '4px 10px', borderRadius: 20 }}>
                  Fastest finger +{scoreBreakdown.firstBonus}
                </span>
              )}
              {scoreBreakdown.streakBonus > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7B7', background: 'rgba(26,137,102,0.2)', padding: '4px 10px', borderRadius: 20 }}>
                  {streak} in a row +{scoreBreakdown.streakBonus}
                </span>
              )}
              {scoreBreakdown.speedBonus < 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 20 }}>
                  Answer sooner for more
                </span>
              )}
            </div>
          )}

          {/* Why, not just whether. This is the part that teaches. */}
          {(() => {
            const q = quiz?.questions[currentIndex]
            if (!q) return null
            const chosen = q.options?.find(o => o.label === selectedAnswer)
            const detail = wasCorrect === false && chosen?.why_wrong ? chosen.why_wrong : q.explanation
            if (!detail) return null
            return (
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{detail}</p>
              </div>
            )
          })()}

          <p style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Waiting for the next question...</p>
        </div>
      )}

      {phase === 'final' && isTeamMode && team && (
        <StudentTeamFinal teams={teams.length ? teams : [team]} myTeamId={team.id} />
      )}

      {/* A team player whose team could not be loaded still gets their result
          rather than a blank screen. */}
      {phase === 'final' && isTeamMode && !team && (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Game over</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>Thanks for playing, {name}.</p>
          <div style={{ background: 'rgba(239,159,39,0.15)', border: '0.5px solid #D97010', borderRadius: 16, padding: '22px 32px', display: 'inline-block' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your score</p>
            <p style={{ fontSize: 44, fontWeight: 700, color: '#D97010' }}>{totalScore}</p>
          </div>
        </div>
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
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            Great job, {name}{myRank ? ` · Rank #${myRank}` : ''}.
          </p>
          <div style={{
            background: 'rgba(239,159,39,0.15)', border: '0.5px solid #D97010',
            borderRadius: 16, padding: '22px 32px', marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your final score</p>
            <p style={{ fontSize: 48, fontWeight: 700, color: '#D97010' }}>{totalScore}</p>
          </div>

          {leaderboard.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)', marginBottom: 10,
              }}>
                Leaderboard
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaderboard.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      background: p.id === participantId ? 'rgba(239,159,39,0.18)' : 'rgba(255,255,255,0.06)',
                      border: `0.5px solid ${p.id === participantId ? '#D97010' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span style={{ width: 22, fontWeight: 800, color: i === 0 ? '#D97010' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.display_name}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: i === 0 ? '#D97010' : 'rgba(255,255,255,0.7)' }}>{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {participantId && <GuestClaimBanner sessionType="engage" submissionId={participantId} />}
        </div>
      )}
    </div>
  )
}
