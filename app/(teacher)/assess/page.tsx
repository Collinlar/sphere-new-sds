'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { Exam, ExamSession } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: '#185FA5', bg: '#E6F1FB' },
  active:    { label: 'Live',       color: '#085041', bg: '#E1F5EE' },
  grading:   { label: 'Needs grading', color: '#7A4A00', bg: '#FEF3DC' },
  completed: { label: 'Done',       color: '#5A5A5A', bg: '#F3F4F6' },
}

interface SessionRow extends ExamSession {
  submission_count: number
}

interface ExamWithSessions extends Exam {
  sessions: SessionRow[]
}

export default function AssessDashboard() {
  const [exams, setExams] = useState<ExamWithSessions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const allSessions = exams.flatMap(e => e.sessions)
  const activeSessions  = allSessions.filter(s => s.status === 'active').length
  const pendingGrading  = allSessions.filter(s => s.status === 'grading').length
  const completedSessions = allSessions.filter(s => s.status === 'completed').length

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('exams')
        .select('*, exam_sessions(*, exam_submissions(count))')
        .eq('institution_id', getCurrentUser().institution_id)
        .order('created_at', { ascending: false })

      if (error) {
        setError('Could not reach your exam records. Try refreshing the page.')
        setLoading(false)
        return
      }

      const mapped: ExamWithSessions[] = (data ?? []).map(e => ({
        ...e,
        sessions: ((e.exam_sessions ?? []) as (ExamSession & { exam_submissions: { count: number }[] })[])
          .map(s => ({
            ...s,
            submission_count: s.exam_submissions?.[0]?.count ?? 0,
          }))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }))

      setExams(mapped)

      // Auto-expand exams that have pending grading sessions
      const autoExpand: Record<string, boolean> = {}
      mapped.forEach(e => {
        if (e.sessions.some(s => s.status === 'grading' || s.status === 'active')) {
          autoExpand[e.id] = true
        }
      })
      setExpanded(autoExpand)

      setLoading(false)
    }
    load()
  }, [])

  function toggleExpand(examId: string) {
    setExpanded(prev => ({ ...prev, [examId]: !prev[examId] }))
  }

  function sessionAction(s: SessionRow) {
    if (s.status === 'active') return (
      <Link href={`/assess/session/${s.id}`}>
        <button style={actionBtn('#E05C4B', '#fff')}>Resume live session</button>
      </Link>
    )
    if (s.status === 'scheduled') return (
      <Link href={`/assess/session/${s.id}`}>
        <button style={actionBtn('#E05C4B', '#fff')}>Start session</button>
      </Link>
    )
    if (s.status === 'grading') return (
      <Link href={`/assess/grading/${s.id}`}>
        <button style={actionBtn('#EF9F27', '#fff')}>Grade now</button>
      </Link>
    )
    if (s.status === 'completed') return (
      <Link href={`/assess/results/${s.id}`}>
        <button style={actionBtn('var(--white)', 'var(--near-black)', true)}>View results</button>
      </Link>
    )
    return null
  }

  const hasActiveOrGrading = (exam: ExamWithSessions) =>
    exam.sessions.some(s => s.status === 'active' || s.status === 'scheduled')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="assess"
        title="Assess"
        right={
          <Link href="/assess/create">
            <button style={{ background: '#E05C4B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + New Exam
            </button>
          </Link>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total exams',        value: loading ? '...' : exams.length },
            { label: 'Active sessions',    value: loading ? '...' : activeSessions,   accent: activeSessions > 0 ? '#085041' : undefined },
            { label: 'Needs grading',      value: loading ? '...' : pendingGrading,   accent: pendingGrading > 0 ? '#7A4A00' : undefined },
            { label: 'Completed sessions', value: loading ? '...' : completedSessions },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '18px 20px' }}>
              <p style={{ fontSize: 11, color: 'var(--mid-grey)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 600, color: s.accent ?? 'var(--near-black)', lineHeight: 1.1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Alerts for sessions needing attention */}
        {pendingGrading > 0 && (
          <div style={{ background: '#FEF3DC', border: '0.5px solid #EF9F27', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚑</span>
            <p style={{ fontSize: 13, color: '#7A4A00' }}>
              {pendingGrading} session{pendingGrading > 1 ? 's' : ''} waiting to be graded. Students cannot see their results until grading is published.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>Exams</h2>
        </div>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
            Loading your exam records...
          </div>
        )}

        {error && (
          <div style={{ background: '#FDECEA', border: '0.5px solid #E05C4B', borderRadius: 10, padding: '16px 20px', color: '#7A1A10', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && exams.length === 0 && (
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '56px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📝</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>No exams yet</p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>Build your first exam and schedule it with a class.</p>
            <Link href="/assess/create">
              <button style={{ background: '#E05C4B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Create your first exam
              </button>
            </Link>
          </div>
        )}

        {!loading && !error && exams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {exams.map(exam => {
              const totalMarks = exam.questions?.reduce((s, q) => s + q.marks, 0) ?? 0
              const isExpanded = !!expanded[exam.id]
              const needsAttention = exam.sessions.some(s => s.status === 'grading')

              return (
                <div key={exam.id} style={{ background: 'var(--white)', border: `0.5px solid ${needsAttention ? '#EF9F27' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>

                  {/* Exam header row */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{exam.title}</p>
                        {needsAttention && (
                          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7A4A00', background: '#FEF3DC', padding: '2px 7px', borderRadius: 4 }}>
                            Needs grading
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--mid-grey)' }}>
                        {exam.subject && <span>{exam.subject}</span>}
                        {exam.grade_level && <span>{exam.grade_level}</span>}
                        <span>{exam.questions?.length ?? 0} questions</span>
                        <span>{totalMarks} marks</span>
                        <span>{exam.duration_minutes} min</span>
                        <span style={{ color: isExpanded ? '#E05C4B' : 'var(--mid-grey)' }}>
                          {exam.sessions.length} {exam.sessions.length === 1 ? 'session' : 'sessions'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!hasActiveOrGrading(exam) && (
                        <Link href={`/assess/session/new?exam=${exam.id}`}>
                          <button style={{ background: '#E05C4B', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                            + New session
                          </button>
                        </Link>
                      )}
                      {exam.sessions.length > 0 && (
                        <button
                          onClick={() => toggleExpand(exam.id)}
                          style={{ background: 'var(--page-bg)', border: '0.5px solid var(--border)', borderRadius: 7, padding: '7px 12px', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                        >
                          {isExpanded ? 'Hide' : 'Show'} sessions
                          <span style={{ fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sessions list */}
                  {isExpanded && exam.sessions.length > 0 && (
                    <div style={{ borderTop: '0.5px solid var(--border)' }}>
                      {/* Table header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 130px 160px', gap: 0, padding: '8px 20px', background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                        {['Date', 'Code', 'Students', 'Status', ''].map(h => (
                          <p key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--mid-grey)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</p>
                        ))}
                      </div>

                      {exam.sessions.map((s, idx) => {
                        const meta = STATUS_META[s.status]
                        const date = new Date(s.created_at)
                        const isLast = idx === exam.sessions.length - 1
                        return (
                          <div
                            key={s.id}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 130px 160px', gap: 0, padding: '13px 20px', borderBottom: isLast ? 'none' : '0.5px solid var(--border)', alignItems: 'center', background: s.status === 'grading' ? '#FFFBF0' : 'var(--white)' }}
                          >
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>
                                {date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 1 }}>
                                {date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--near-black)' }}>
                              {s.join_code}
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--near-black)' }}>
                              {s.submission_count} {s.submission_count === 1 ? 'student' : 'students'}
                            </p>
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color, background: meta.bg, padding: '3px 8px', borderRadius: 4 }}>
                                {meta.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              {sessionAction(s)}
                            </div>
                          </div>
                        )
                      })}

                      {/* Footer: new session link if no active/grading */}
                      {!hasActiveOrGrading(exam) && (
                        <div style={{ padding: '10px 20px', borderTop: '0.5px solid var(--border)', background: 'var(--page-bg)' }}>
                          <Link href={`/assess/session/new?exam=${exam.id}`}>
                            <button style={{ background: 'transparent', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                              + Run another session of this exam
                            </button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsed nudge for pending grading */}
                  {!isExpanded && needsAttention && (
                    <div style={{ padding: '10px 20px', borderTop: '0.5px solid #F5DFA0', background: '#FFFBF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, color: '#7A4A00' }}>
                        {exam.sessions.filter(s => s.status === 'grading').length} session{exam.sessions.filter(s => s.status === 'grading').length > 1 ? 's' : ''} waiting to be graded
                      </p>
                      <button onClick={() => toggleExpand(exam.id)} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: '#7A4A00', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Show sessions
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function actionBtn(bg: string, color: string, bordered = false): React.CSSProperties {
  return {
    background: bg, color, border: bordered ? '0.5px solid var(--border)' : 'none',
    borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit',
  }
}
