'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ExamSession, ExamSubmission, Exam } from '@/lib/types'
import { generateJoinCode } from '@/lib/utils'
import { getCurrentUser } from '@/lib/auth'
import { generateTicketsForSession, type TicketWithStudent } from '@/lib/tickets'

interface FlagEvent { type: string; at: string; count: number }

function parseFlagEvents(flags: string[]): FlagEvent[] {
  return flags.map(f => { try { return JSON.parse(f) as FlagEvent } catch { return null } }).filter(Boolean) as FlagEvent[]
}

const FLAG_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tab_switch:    { label: 'Tab switch',    color: '#C23B2A', bg: 'rgba(224,92,75,0.15)' },
  window_blur:   { label: 'Left window',   color: '#D97010', bg: 'rgba(239,159,39,0.15)' },
  copy_detected: { label: 'Copied text',   color: '#D97010', bg: 'rgba(239,159,39,0.15)' },
  right_click:   { label: 'Right-clicked', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
  manual:        { label: 'Flagged by invigilator', color: '#C23B2A', bg: 'rgba(224,92,75,0.15)' },
}

const STUDENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  not_started: { label: 'Not started', color: 'var(--mid-grey)', dot: '#EDECE9' },
  in_progress: { label: 'In progress', color: '#1052A3', dot: '#1052A3' },
  submitted: { label: 'Submitted', color: '#1A8966', dot: '#1A8966' },
  flagged: { label: 'Flagged', color: '#C23B2A', dot: '#C23B2A' },
}

function InvigilatorViewInner() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const examId = searchParams.get('exam')

  const [session, setSession] = useState<ExamSession | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([])
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [actionTarget, setActionTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tickets, setTickets] = useState<TicketWithStudent[]>([])
  const creatingRef = useRef(false)

  const loadData = useCallback(async () => {
    let sessionData: ExamSession | null = null
    let examData: Exam | null = null

    if (id !== 'new') {
      const res = await supabase.from('exam_sessions').select('*, exams(*)').eq('id', id).single()
      if (res.error || !res.data) {
        setError('Could not load this session.')
        setLoading(false)
        return
      }
      sessionData = res.data as ExamSession
      examData = (res.data as { exams: Exam }).exams
    } else if (examId) {
      const examRes = await supabase.from('exams').select('*').eq('id', examId).single()
      if (examRes.error || !examRes.data) {
        setError('Exam not found.')
        setLoading(false)
        return
      }
      examData = examRes.data as Exam

      // Guard: if an active or scheduled session already exists for this exam, resume it
      const existingRes = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('exam_id', examId)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingRes.data) {
        sessionData = existingRes.data as ExamSession
        window.history.replaceState(null, '', `/assess/session/${existingRes.data.id}`)
      } else {
        // Mutex: prevents React Strict Mode double-invocation from creating two sessions
        if (creatingRef.current) return
        creatingRef.current = true
        const code = generateJoinCode(6)
        const insertRes = await supabase.from('exam_sessions').insert({
          exam_id: examId,
          invigilator_id: getCurrentUser().id,
          join_code: code,
          status: 'active',
          scheduled_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }).select().single()

        if (insertRes.error || !insertRes.data) {
          creatingRef.current = false
          setError('Could not create a session right now.')
          setLoading(false)
          return
        }
        sessionData = insertRes.data as ExamSession
        window.history.replaceState(null, '', `/assess/session/${insertRes.data.id}`)

        if (examData.audience === 'roster_ticket') {
          const generated = await generateTicketsForSession(sessionData.id, examData)
          setTickets(generated)
        }
      }
    }

    // Resuming a session (existing id, or matched an active/scheduled one) — load its tickets
    if (sessionData && examData?.audience === 'roster_ticket' && tickets.length === 0) {
      const { data: existingTickets } = await supabase
        .from('exam_tickets')
        .select('code, users(name, email)')
        .eq('exam_session_id', sessionData.id)
      if (existingTickets && existingTickets.length > 0) {
        setTickets(existingTickets.map(t => {
          const u = t.users as unknown as { name: string; email: string }
          return { code: t.code, name: u?.name, email: u?.email }
        }))
      }
    }

    setSession(sessionData)
    setExam(examData)

    if (sessionData) {
      const subRes = await supabase.from('exam_submissions').select('*').eq('exam_session_id', sessionData.id)
      setSubmissions(subRes.data ?? [])

      if (examData && sessionData.scheduled_at) {
        const elapsed = (Date.now() - new Date(sessionData.scheduled_at).getTime()) / 1000
        const remaining = examData.duration_minutes * 60 - elapsed
        setTimeLeft(Math.max(0, remaining))
      }
    }

    setLoading(false)
  }, [id, examId])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft((prev) => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  useEffect(() => {
    if (!session) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('exam_submissions').select('*').eq('exam_session_id', session.id)
      if (data) setSubmissions(data)
    }, 5000)
    return () => clearInterval(interval)
  }, [session])

  async function manualFlag(subId: string) {
    setActionTarget(subId)
    const sub = submissions.find(s => s.id === subId)
    if (!sub) { setActionTarget(null); return }
    const flag = JSON.stringify({ type: 'manual', at: new Date().toISOString(), count: (sub.integrity_flags?.length ?? 0) + 1 })
    await supabase.from('exam_submissions').update({
      integrity_flags: [...(sub.integrity_flags ?? []), flag],
    }).eq('id', subId)
    const { data } = await supabase.from('exam_submissions').select('*').eq('exam_session_id', session!.id)
    if (data) setSubmissions(data)
    setActionTarget(null)
  }

  async function clearFlags(subId: string) {
    setActionTarget(subId)
    await supabase.from('exam_submissions').update({ integrity_flags: [] }).eq('id', subId)
    const { data } = await supabase.from('exam_submissions').select('*').eq('exam_session_id', session!.id)
    if (data) setSubmissions(data)
    setActionTarget(null)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function forceSubmit(subId: string) {
    const sub = submissions.find(s => s.id === subId)
    setActionTarget(subId)
    await supabase.from('exam_submissions').update({ submitted_at: new Date().toISOString() }).eq('id', subId)
    const { data } = await supabase.from('exam_submissions').select('*').eq('exam_session_id', session!.id)
    if (data) setSubmissions(data)
    setActionTarget(null)
    if (sub) showToast(`Exam submitted for ${sub.student_name}`)
  }

  async function endSession() {
    if (!session) return
    setEnding(true)
    await supabase.from('exam_sessions').update({ status: 'grading' }).eq('id', session.id)
    setEnding(false)
    router.push(`/assess/session/${session.id}/summary`)
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function getStudentStatus(sub?: ExamSubmission): string {
    if (!sub) return 'not_started'
    if (sub.integrity_flags?.length > 0) return 'flagged'
    if (sub.submitted_at) return 'submitted'
    return 'in_progress'
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Setting up the exam hall...</p>
      </div>
    )
  }

  if (error || !session || !exam) {
    return (
      <div style={{ height: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#C23B2A', fontSize: 14 }}>{error ?? 'Session not found.'}</p>
      </div>
    )
  }

  const submittedCount = submissions.filter((s) => s.submitted_at).length
  const flaggedCount = submissions.filter((s) => s.integrity_flags?.length > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0C1021', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @media (max-width: 640px) {
          .session-header { flex-direction: column; gap: 12px; padding: 12px 16px !important; }
          .session-header > div { text-align: center; }
          .session-header > div:first-child { text-align: center; }
          .session-header > div:last-child { text-align: center; }
          .session-header p:first-of-type { font-size: 10px; }
          .session-header p:last-of-type { font-size: 20px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-cell { padding: 12px 16px !important; }
          .stats-cell p:first-child { font-size: 10px; }
          .stats-cell p:last-child { font-size: 20px; }
          .student-list { padding: 12px 16px !important; gap: 6px !important; }
          .student-row { padding: 10px 12px !important; flex-wrap: wrap; }
          .student-controls { width: 100%; padding-left: 46px !important; gap: 4px !important; }
          .student-controls button { flex: 0 1 auto; padding: 5px 10px !important; font-size: 11px; }
          .integrity-timeline { display: none; }
          .session-footer { padding: 12px 16px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="session-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Exam hall</p>
          <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginTop: 2 }}>{exam.title}</p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            {exam.audience === 'roster_ticket' ? 'Students use their tickets' : 'Join code'}
          </p>
          {exam.audience !== 'roster_ticket' && (
            <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.15em', color: '#C23B2A' }}>{session.join_code}</p>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Time remaining</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: timeLeft !== null && timeLeft < 300 ? '#C23B2A' : '#fff' }}>
            {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
          </p>
        </div>
      </div>

      {/* Student tickets */}
      {exam.audience === 'roster_ticket' && tickets.length > 0 && (
        <details style={{ flexShrink: 0, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <summary style={{ padding: '10px 28px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', listStyle: 'none' }}>
            Student tickets ({tickets.length}) — click to view and copy
          </summary>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '0 28px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => {
                  const text = tickets.map(t => `${t.name}\t${t.email ?? ''}\t${t.code}`).join('\n')
                  navigator.clipboard.writeText(text)
                }}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                Copy all
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {tickets.map(t => (
                <div key={t.code} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.08em', color: '#C23B2A' }}>{t.code}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.code)}
                    style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {[
          { label: 'Total students', value: submissions.length },
          { label: 'In progress', value: submissions.filter((s) => !s.submitted_at).length },
          { label: 'Submitted', value: submittedCount },
          { label: 'Flagged', value: flaggedCount },
        ].map((s) => (
          <div key={s.label} className="stats-cell" style={{ background: '#0C1021', padding: '14px 24px', borderRight: '0.5px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Student list */}
      <div className="student-list" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            {exam.audience === 'roster_ticket'
              ? 'Waiting for students to join with their personal tickets'
              : `Waiting for students to join with code ${session.join_code}`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissions.map((sub) => {
              const status = getStudentStatus(sub)
              const meta = STUDENT_STATUS[status]
              const isBusy = actionTarget === sub.id
              const alreadySubmitted = !!sub.submitted_at
              const parsedFlags = parseFlagEvents(sub.integrity_flags ?? [])
              const flagCount = parsedFlags.length
              return (
                <div key={sub.id} className="student-row" style={{
                  background: flagCount > 0 ? 'rgba(194,59,42,0.08)' : 'rgba(255,255,255,0.04)',
                  borderLeft: flagCount > 0 ? '3px solid #C23B2A' : '3px solid transparent',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', width: '100%' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: flagCount > 0 ? 'rgba(194,59,42,0.25)' : alreadySubmitted ? 'rgba(26,137,102,0.25)' : 'rgba(255,255,255,0.08)',
                      color: flagCount > 0 ? '#C23B2A' : alreadySubmitted ? '#1A8966' : 'rgba(255,255,255,0.6)',
                      fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {sub.student_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#fff' }}>{sub.student_name}</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
                      <span style={{ fontSize: 12, color: meta.color }}>{meta.label}</span>
                    </div>
                  </div>

                  {/* Flag timeline */}
                  {flagCount > 0 && (
                    <div className="integrity-timeline" style={{ borderTop: '0.5px solid rgba(224,92,75,0.2)', padding: '10px 16px 10px 66px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C23B2A', marginBottom: 4 }}>
                        Integrity events
                      </p>
                      {parsedFlags.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 52 }}>
                            {new Date(f.at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: FLAG_LABELS[f.type]?.color ?? '#C23B2A',
                            background: FLAG_LABELS[f.type]?.bg ?? 'rgba(224,92,75,0.15)',
                            padding: '2px 7px', borderRadius: 3,
                          }}>
                            {FLAG_LABELS[f.type]?.label ?? f.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Teacher controls */}
                  <div className="student-controls" style={{ display: 'flex', gap: 8, padding: '8px 16px 12px 66px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => manualFlag(sub.id)} disabled={isBusy || alreadySubmitted} style={controlBtn('#C23B2A', isBusy || alreadySubmitted)}>
                      Flag manually
                    </button>
                    {flagCount > 0 && (
                      <button onClick={() => clearFlags(sub.id)} disabled={isBusy} style={controlBtn('rgba(255,255,255,0.12)', isBusy)}>
                        Clear all flags
                      </button>
                    )}
                    {!alreadySubmitted && (
                      <button onClick={() => forceSubmit(sub.id)} disabled={isBusy} style={controlBtn('rgba(255,255,255,0.08)', isBusy)}>
                        Force submit
                      </button>
                    )}
                    {isBusy && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>Updating...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1A8966', color: '#fff', borderRadius: 10,
          padding: '12px 22px', fontSize: 13, fontWeight: 600,
          zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Footer */}
      <div className="session-footer" style={{ padding: '16px 28px', borderTop: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={endSession}
          disabled={ending}
          style={{
            background: '#C23B2A',
            border: 'none',
            borderRadius: 10,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            cursor: ending ? 'wait' : 'pointer',
          }}
        >
          {ending ? 'Ending session...' : 'End session and grade'}
        </button>
      </div>
    </div>
  )
}

function controlBtn(bg: string, disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'rgba(255,255,255,0.04)' : bg,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  }
}

export default function InvigilatorView() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mid-grey)' }}>Loading session...</div>}>
      <InvigilatorViewInner />
    </Suspense>
  )
}
