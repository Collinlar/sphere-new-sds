'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Exam, ExamSession, ExamQuestion } from '@/lib/types'
import { IconFlag, IconInfo, IconCheck } from '@/components/icons'

type ExamPhase = 'join' | 'instructions' | 'exam' | 'confirmation' | 'done'

type FlagType = 'tab_switch' | 'window_blur' | 'copy_detected' | 'right_click'
interface IntegrityFlag { type: FlagType; at: string; count: number }

export default function StudentExam() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [phase, setPhase] = useState<ExamPhase>('join')
  const [name, setName] = useState('')
  const [, setSession] = useState<ExamSession | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeQ, setActiveQ] = useState(0)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [joining, setJoining] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flagWarning, setFlagWarning] = useState<string | null>(null)
  const submissionIdRef = useRef<string | null>(null)
  const phaseRef = useRef<ExamPhase>('join')
  const flagCountRef = useRef(0)

  interface TicketInfo { id: string; user_id: string; exam_session_id: string; redeemed_at: string | null; name: string }
  const [ticket, setTicket] = useState<TicketInfo | null>(null)
  const [ticketUsed, setTicketUsed] = useState(false)
  const [checkingTicket, setCheckingTicket] = useState(true)

  // Keep refs in sync so event listeners always have current values
  useEffect(() => { submissionIdRef.current = submissionId }, [submissionId])
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    async function checkTicket() {
      const { data } = await supabase
        .from('exam_tickets')
        .select('id, user_id, exam_session_id, redeemed_at, users(name)')
        .eq('code', code.toUpperCase())
        .maybeSingle()

      if (data) {
        const u = data.users as unknown as { name: string }
        setTicket({ id: data.id, user_id: data.user_id, exam_session_id: data.exam_session_id, redeemed_at: data.redeemed_at, name: u?.name ?? '' })
        if (data.redeemed_at) {
          setTicketUsed(true)
        } else {
          setName(u?.name ?? '')
        }
      }
      setCheckingTicket(false)
    }
    checkTicket()
  }, [code])

  // Poll for teacher force-submit: if submitted_at appears externally, transition to done
  useEffect(() => {
    if (phase !== 'exam' || !submissionId) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('exam_submissions')
        .select('submitted_at')
        .eq('id', submissionId)
        .single()
      if (data?.submitted_at) {
        clearInterval(interval)
        setPhase('done')
        setTimeout(() => router.push(`/student/assess/results/${submissionId}`), 2500)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [phase, submissionId, router])

  const recordFlag = useCallback(async (type: FlagType) => {
    if (phaseRef.current !== 'exam') return
    const sid = submissionIdRef.current
    if (!sid || !exam) return

    flagCountRef.current += 1
    const newCount = flagCountRef.current
    const flag: IntegrityFlag = { type, at: new Date().toISOString(), count: newCount }

    const { data } = await supabase.from('exam_submissions').select('integrity_flags').eq('id', sid).single()
    const current: string[] = data?.integrity_flags ?? []
    const updatedFlags = [...current, JSON.stringify(flag)]
    await supabase.from('exam_submissions').update({ integrity_flags: updatedFlags }).eq('id', sid)

    const policy = (exam.settings?.integrity_action as string) ?? 'warn'
    const threshold = (exam.settings?.integrity_threshold as number) ?? 3

    if (policy === 'auto_disqualify' && newCount >= threshold) {
      // Auto-disqualify: mark submission, force done state
      await supabase.from('exam_submissions').update({
        submitted_at: new Date().toISOString(),
        result_status: 'disqualified',
        result_note: `Auto-disqualified after ${newCount} integrity violations.`,
      }).eq('id', sid)
      phaseRef.current = 'done'
      setPhase('done')
      return
    }

    if (policy === 'record') return // silent — no warning shown

    const messages: Record<FlagType, string> = {
      tab_switch: 'Switching tabs during an exam has been flagged.',
      window_blur: 'Leaving this window during an exam has been flagged.',
      copy_detected: 'Copying text during an exam has been flagged.',
      right_click: 'Right-clicking during an exam has been flagged.',
    }
    setFlagWarning(messages[type])
    setTimeout(() => setFlagWarning(null), 4000)
  }, [exam])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') recordFlag('tab_switch')
    }
    function onBlur() { recordFlag('window_blur') }
    function onCopy() { recordFlag('copy_detected') }
    function onContextMenu(e: MouseEvent) { e.preventDefault(); recordFlag('right_click') }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [recordFlag])

  useEffect(() => {
    if (!timeLeft || phase !== 'exam') return
    if (timeLeft <= 0) {
      handleSubmit()
      return
    }
    const t = setTimeout(() => setTimeLeft((prev) => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(t)
  })

  const handleSubmit = useCallback(async () => {
    if (submitting || !submissionId) return
    setSubmitting(true)
    await supabase.from('exam_submissions').update({
      answers,
      submitted_at: new Date().toISOString(),
    }).eq('id', submissionId)
    setSubmitting(false)
    setPhase('done')
    // Navigate to results page after a short delay so student sees confirmation first
    setTimeout(() => router.push(`/student/assess/results/${submissionId}`), 2500)
  }, [submitting, submissionId, answers])

  async function handleJoin() {
    setJoining(true)
    setError(null)

    if (ticket) {
      if (ticket.redeemed_at) {
        setError('This ticket has already been used. Ask your teacher if you need to retake the exam.')
        setJoining(false)
        return
      }

      const { data: sessionData } = await supabase
        .from('exam_sessions')
        .select('*, exams(*)')
        .eq('id', ticket.exam_session_id)
        .eq('status', 'active')
        .single()

      if (!sessionData) {
        setError('This exam is not active right now. Check with your teacher.')
        setJoining(false)
        return
      }

      const { data: sub, error: subErr } = await supabase
        .from('exam_submissions')
        .insert({
          exam_session_id: sessionData.id,
          student_name: ticket.name,
          student_id: ticket.user_id,
          ticket_id: ticket.id,
          answers: {},
          integrity_flags: [],
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (subErr || !sub) {
        setError('Could not start the exam. Try again in a moment.')
        setJoining(false)
        return
      }

      await supabase.from('exam_tickets').update({
        redeemed_at: new Date().toISOString(),
        exam_submission_id: sub.id,
      }).eq('id', ticket.id)

      const examData = (sessionData as { exams: Exam }).exams
      setSession(sessionData as ExamSession)
      setExam(examData)
      setSubmissionId(sub.id)
      setTimeLeft(examData.duration_minutes * 60)
      setJoining(false)
      setPhase('instructions')
      return
    }

    if (!name.trim()) { setError('Tell us your name first.'); setJoining(false); return }

    const { data: sessionData } = await supabase
      .from('exam_sessions')
      .select('*, exams(*)')
      .eq('join_code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (!sessionData) {
      setError('That exam code is not active. Check with your teacher.')
      setJoining(false)
      return
    }

    const examDataCheck = (sessionData as { exams: Exam }).exams
    const currentUser = getCurrentUser()

    if (examDataCheck.audience === 'roster_login') {
      if (!currentUser?.id) {
        setError('You need to sign in with your school account to take this exam.')
        setJoining(false)
        return
      }

      const { data: membership } = await supabase
        .from('roster_members')
        .select('groups')
        .eq('roster_id', examDataCheck.roster_id)
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .maybeSingle()

      const groupsOk = !examDataCheck.audience_groups?.length
        || membership?.groups?.some((g: string) => examDataCheck.audience_groups!.includes(g))

      if (!membership || !groupsOk) {
        setError('This exam is restricted to a specific class. Check with your teacher if you believe this is a mistake.')
        setJoining(false)
        return
      }
    }

    const { data: sub, error: subErr } = await supabase
      .from('exam_submissions')
      .insert({
        exam_session_id: sessionData.id,
        student_name: name.trim(),
        student_id: currentUser?.id ?? null,
        answers: {},
        integrity_flags: [],
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (subErr || !sub) {
      setError('Could not start the exam. Try again in a moment.')
      setJoining(false)
      return
    }

    const examData = (sessionData as { exams: Exam }).exams
    setSession(sessionData as ExamSession)
    setExam(examData)
    setSubmissionId(sub.id)
    setTimeLeft(examData.duration_minutes * 60)
    setJoining(false)
    setPhase('instructions')
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function answered(qId: string) { return !!answers[qId] }
  function answeredCount() { return exam ? exam.questions.filter((q) => answered(q.id)).length : 0 }

  const currentQ: ExamQuestion | undefined = exam?.questions[activeQ]

  const inputStyle = {
    background: '#f9f9f9',
    border: '0.5px solid #EDECE9',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: '#18171A',
    width: '100%',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    minHeight: 56,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* JOIN */}
      {phase === 'join' && checkingTicket && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 14, color: '#6B6870' }}>Checking your code...</p>
        </div>
      )}

      {phase === 'join' && !checkingTicket && ticketUsed && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#18171A' }}>This ticket has already been used</h1>
          <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.6 }}>If you think this is a mistake, ask your teacher to check your exam record.</p>
        </div>
      )}

      {phase === 'join' && !checkingTicket && !ticketUsed && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6870' }}>
            Exam code: {code?.toUpperCase()}
          </p>
          {ticket ? (
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#18171A', textAlign: 'center', lineHeight: 1.2 }}>
              Welcome, {ticket.name}. Ready for your exam?
            </h1>
          ) : (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#18171A', textAlign: 'center', lineHeight: 1.2 }}>Ready for your exam?</h1>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="What's your name?"
                style={{ ...inputStyle, fontSize: 18, textAlign: 'center' }}
              />
            </>
          )}
          {error && <p style={{ color: '#C23B2A', fontSize: 13 }}>{error}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              width: '100%',
              background: '#C23B2A',
              border: 'none',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              cursor: joining ? 'wait' : 'pointer',
              minHeight: 56,
            }}
          >
            {joining ? 'Starting...' : 'Begin exam'}
          </button>
        </div>
      )}

      {/* INSTRUCTIONS */}
      {phase === 'instructions' && exam && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--navy)', padding: '22px 22px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
              Instructions · {exam.subject ?? 'Exam'}{exam.grade_level ? ` · ${exam.grade_level}` : ''}
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{exam.title}</p>
          </div>
          <div style={{ padding: '22px 20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Questions', value: exam.questions.length, isTime: false },
                { label: 'Total marks', value: exam.questions.reduce((s, q) => s + q.marks, 0), isTime: false },
                { label: 'Time', value: exam.duration_minutes, isTime: true },
              ].map((s) => (
                <div key={s.label} style={{
                  flex: 1,
                  background: 'var(--white)',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: 'var(--shadow-soft)',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: s.isTime ? 22 : 28, fontWeight: 700, color: 'var(--near-black)' }}>
                    {s.isTime ? (
                      <>{s.value}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>m</span></>
                    ) : s.value}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow-soft)', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>Instructions</p>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.65 }}>
                {exam.instructions || 'Answer all questions. Flag ones you are unsure of and revisit them before submitting.'}
              </p>
            </div>

            <div style={{
              background: 'var(--amber-light)',
              borderRadius: 10,
              padding: '13px 16px',
              marginBottom: 22,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <IconInfo size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--amber)' }} />
              <p style={{ fontSize: 12, color: '#9A5800', lineHeight: 1.55 }}>
                Your timer starts when you tap below. Once you submit, you cannot change your answers.
              </p>
            </div>

            <button
              onClick={() => setPhase('exam')}
              style={{
                background: 'var(--coral)',
                border: 'none',
                borderRadius: 12,
                padding: 16,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                minHeight: 52,
                marginTop: 'auto',
              }}
            >
              Start the exam →
            </button>
          </div>
        </div>
      )}

      {/* EXAM */}
      {phase === 'exam' && exam && currentQ && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Integrity warning */}
          {flagWarning && (
            <div style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#C23B2A',
              color: '#fff',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 13,
              fontWeight: 600,
              zIndex: 200,
              maxWidth: 360,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              {flagWarning}
            </div>
          )}

          {/* Top bar */}
          <div style={{
            background: 'var(--navy)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{exam.title}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginTop: 2 }}>
                Question {activeQ + 1} of {exam.questions.length}
              </p>
            </div>
            <div style={{
              background: timeLeft !== null && timeLeft < 300 ? 'var(--coral)' : 'var(--amber)',
              borderRadius: 10,
              padding: '8px 14px',
            }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </p>
            </div>
          </div>

          {/* Progress strip + question pills */}
          <div style={{ background: 'var(--white)', padding: '12px 20px 14px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${Math.round(((activeQ + 1) / exam.questions.length) * 100)}%`, height: '100%', background: 'var(--coral)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{Math.round(((activeQ + 1) / exam.questions.length) * 100)}% complete</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--coral)' }}>
                {currentQ.type === 'mcq' ? 'Multiple choice' : currentQ.type === 'true_false' ? 'True / False' : currentQ.type === 'short' ? 'Short answer' : 'Essay'} · {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
              {exam.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setActiveQ(i)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    border: 'none',
                    background: activeQ === i ? 'var(--coral)' : flaggedQuestions.has(q.id) ? 'var(--amber-light)' : answered(q.id) ? 'var(--teal-light)' : 'var(--border)',
                    color: activeQ === i ? '#fff' : flaggedQuestions.has(q.id) ? 'var(--amber)' : answered(q.id) ? 'var(--teal)' : 'var(--text-tertiary)',
                    fontSize: 13,
                    fontWeight: activeQ === i ? 700 : 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: flaggedQuestions.has(q.id) && activeQ !== i ? '0 0 0 1.5px var(--amber)' : 'none',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 22px' }}>
            <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: '#18171A', lineHeight: 1.5 }}>{currentQ.text}</p>
            </div>

            {(currentQ.type === 'mcq' || currentQ.type === 'true_false') && currentQ.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {currentQ.options.map((opt) => {
                  const selected = answers[currentQ.id] === opt.label
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: opt.label }))}
                      style={{
                        width: '100%',
                        background: selected ? '#FDECEA' : '#fff',
                        boxShadow: selected ? '0 0 0 1.5px #C23B2A' : 'var(--shadow-soft)',
                        borderRadius: 10,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        minHeight: 52,
                      }}
                    >
                      <span style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        background: selected ? '#C23B2A' : '#EDECE9',
                        color: selected ? '#fff' : '#6B6870',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 15, color: selected ? '#C23B2A' : '#18171A', fontWeight: selected ? 500 : 400 }}>{opt.text}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {(currentQ.type === 'short' || currentQ.type === 'essay') && (
              <>
                <textarea
                  value={answers[currentQ.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                  placeholder={currentQ.type === 'short' ? 'Write your answer here.' : 'Write your essay response here.'}
                  rows={currentQ.type === 'essay' ? 8 : 4}
                  style={{
                    ...inputStyle,
                    background: '#fff',
                    boxShadow: 'var(--shadow-soft)',
                    resize: 'vertical',
                    lineHeight: 1.7,
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px 0' }}>
                  <span style={{ fontSize: 12, color: '#A09DA8' }}>
                    {(answers[currentQ.id] ?? '').trim() === '' ? 0 : (answers[currentQ.id] ?? '').trim().split(/\s+/).length} words
                  </span>
                  <span style={{ fontSize: 12, color: '#A09DA8' }}>No word limit</span>
                </div>
              </>
            )}
          </div>

          {/* Nav footer */}
          <div style={{
            background: 'var(--white)',
            borderTop: '0.5px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setActiveQ((prev) => Math.max(0, prev - 1))}
              disabled={activeQ === 0}
              aria-label="Previous question"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                border: 'none',
                borderRadius: 9,
                fontSize: 18,
                color: activeQ === 0 ? 'var(--border2)' : 'var(--text-tertiary)',
                cursor: activeQ === 0 ? 'default' : 'pointer',
              }}
            >
              ‹
            </button>
            <button
              onClick={() => setFlaggedQuestions(prev => {
                const next = new Set(prev)
                if (next.has(currentQ.id)) next.delete(currentQ.id)
                else next.add(currentQ.id)
                return next
              })}
              style={{
                height: 44,
                flex: 1,
                background: flaggedQuestions.has(currentQ.id) ? 'var(--amber-light)' : 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                border: 'none',
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: flaggedQuestions.has(currentQ.id) ? 'var(--amber)' : 'var(--mid-grey)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <IconFlag size={12} />
              {flaggedQuestions.has(currentQ.id) ? 'Flagged' : 'Flag'}
            </button>
            {activeQ < exam.questions.length - 1 ? (
              <button
                onClick={() => setActiveQ((prev) => prev + 1)}
                style={{
                  flex: 2,
                  height: 44,
                  background: 'var(--coral)',
                  border: 'none',
                  borderRadius: 9,
                  padding: '0 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Next question →
              </button>
            ) : (
              <button
                onClick={() => setPhase('confirmation')}
                style={{
                  flex: 2,
                  height: 44,
                  background: 'var(--coral)',
                  border: 'none',
                  borderRadius: 9,
                  padding: '0 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Submit exam →
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {phase === 'confirmation' && exam && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: 16,
          zIndex: 100,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#18171A', marginBottom: 10 }}>Submit your exam?</h3>
            <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.65, marginBottom: 20 }}>
              You have answered {answeredCount()} of {exam.questions.length} questions. Once you submit, you cannot make changes.
            </p>
            {answeredCount() < exam.questions.length && (
              <div style={{ background: '#FEF0DC', border: '0.5px solid #D97010', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#D97010', marginBottom: 16 }}>
                {exam.questions.length - answeredCount()} question{exam.questions.length - answeredCount() > 1 ? 's' : ''} left unanswered.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPhase('exam')}
                style={{
                  flex: 1,
                  background: '#EDECE9',
                  border: 'none',
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#18171A',
                  cursor: 'pointer',
                }}
              >
                Go back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 2,
                  background: '#C23B2A',
                  border: 'none',
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit my exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === 'done' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--teal-light)',
            color: 'var(--teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconCheck size={36} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#18171A' }}>Exam submitted</h2>
          <p style={{ fontSize: 15, color: '#6B6870', lineHeight: 1.65 }}>
            Your answers have been recorded, {name}. Your teacher will share your results when grading is complete.
          </p>
          <div style={{ background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 12, padding: '16px 24px', marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#6B6870' }}>Answered {answeredCount()} of {exam?.questions.length ?? 0} questions</p>
          </div>
        </div>
      )}
    </div>
  )
}
