'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { ExamSession, ExamSubmission, Exam } from '@/lib/types'
import { gradeFromPercentage } from '@/lib/utils'
import { IconFlag, IconCheck } from '@/components/icons'

const GRADE_COLORS: Record<string, string> = {
  A: '#1A8966', B: '#1052A3', C: '#D97010', D: '#C23B2A', F: '#6B6870',
}

interface FlagEvent { type: string; at: string; count: number }

function parseFlagEvents(flags: string[]): FlagEvent[] {
  return flags.map(f => { try { return JSON.parse(f) as FlagEvent } catch { return null } }).filter(Boolean) as FlagEvent[]
}

const FLAG_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tab_switch:    { label: 'Switched tabs',          color: '#C23B2A', bg: '#FDECEA' },
  window_blur:   { label: 'Left the exam window',   color: '#D97010', bg: '#FEF0DC' },
  copy_detected: { label: 'Copied text',             color: '#D97010', bg: '#FEF0DC' },
  right_click:   { label: 'Right-clicked',           color: '#6B6870', bg: '#EDECE9' },
  manual:        { label: 'Flagged by invigilator',  color: '#C23B2A', bg: '#FDECEA' },
}

function GradingViewInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedStudent = searchParams.get('student')
  const [session, setSession] = useState<ExamSession | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([])
  const [selectedSub, setSelectedSub] = useState<string | null>(null)
  const [manualMarks, setManualMarks] = useState<Record<string, Record<string, number>>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState<Record<string, string>>({})
  const [mobileTab, setMobileTab] = useState<'students' | 'grade'>('students')

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('*, exams(*), exam_submissions(*)')
      .eq('id', id)
      .single()

    if (error || !data) {
      setError('Could not load grading data. Try refreshing.')
      setLoading(false)
      return
    }

    setSession(data as ExamSession)
    setExam((data as { exams: Exam }).exams)
    const subs = (data as { exam_submissions: ExamSubmission[] }).exam_submissions ?? []
    setSubmissions(subs)
    if (subs.length > 0) {
      const target = preselectedStudent && subs.find(s => s.id === preselectedStudent)
      setSelectedSub(target ? target.id : subs[0].id)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  function computeAutoScore(sub: ExamSubmission): number {
    if (!exam) return 0
    return exam.questions.reduce((total, q) => {
      if (q.type === 'mcq' || q.type === 'true_false') {
        const ans = sub.answers?.[q.id]
        if (ans === q.correct) return total + q.marks
      }
      return total
    }, 0)
  }

  function computeTotalScore(sub: ExamSubmission): number {
    const auto = computeAutoScore(sub)
    const manual = Object.values(manualMarks[sub.id] ?? {}).reduce((sum, v) => sum + v, 0)
    return auto + manual
  }

  function computeMaxMarks(): number {
    return exam?.questions.reduce((sum, q) => sum + q.marks, 0) ?? 0
  }

  async function setResultStatus(subId: string, status: 'normal' | 'disqualified' | 'withheld' | 'voided') {
    setStatusTarget(subId)
    const note = noteInput[subId] ?? null
    await supabase.from('exam_submissions').update({ result_status: status, result_note: note }).eq('id', subId)
    await loadData()
    setStatusTarget(null)
  }

  async function publishResults() {
    setPublishing(true)
    const maxMarks = computeMaxMarks()

    await Promise.all(submissions.map(async (sub) => {
      const score = computeTotalScore(sub)
      const pct = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0
      await supabase.from('exam_submissions').update({
        score,
        percentage: pct,
        grade: gradeFromPercentage(pct),
        feedback: feedback[sub.id] ?? null,
        submitted_at: sub.submitted_at ?? new Date().toISOString(),
      }).eq('id', sub.id)
    }))

    await supabase.from('exam_sessions').update({ status: 'completed' }).eq('id', id)
    setPublishing(false)
    router.push(`/assess/results/${id}`)
  }

  const maxMarks = computeMaxMarks()
  const activeSub = submissions.find((s) => s.id === selectedSub)

  const gradeDistribution = submissions.reduce<Record<string, number>>((acc, sub) => {
    const pct = maxMarks > 0 ? Math.round((computeTotalScore(sub) / maxMarks) * 100) : 0
    const grade = gradeFromPercentage(pct)
    acc[grade] = (acc[grade] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div style={{ height: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
        Loading student responses...
      </div>
    )
  }

  if (error || !session || !exam) {
    return (
      <div style={{ height: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#C23B2A', fontSize: 14 }}>{error ?? 'Grading session not found.'}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <style>{`
        /* Desktop: both panels always visible, tabs hidden */
        .mobile-tabs { display: none; }
        .grading-sidebar { display: flex; }
        .grading-panel { display: flex; }

        /* Mobile: tab-driven visibility */
        @media (max-width: 768px) {
          .mobile-tabs { display: flex; height: 44px; background: var(--white); border-bottom: 0.5px solid var(--border); }
          .mobile-tab-btn { flex: 1; border: none; background: transparent; color: var(--mid-grey); font-size: 13px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
          .mobile-tab-btn.active { color: #C23B2A; border-bottom: 2px solid #C23B2A; }
          .grading-layout { flex-direction: column; }
          .grading-sidebar { width: 100% !important; border-right: none !important; border-bottom: 0.5px solid var(--border); display: none; max-height: 200px; }
          .grading-sidebar.mobile-show { display: flex; overflow-y: auto; }
          .grading-panel { display: none; }
          .grading-panel.mobile-show { display: flex; }
        }
      `}</style>
      <TopBar
        mode="assess"
        title={`Grading: ${exam.title}`}
        right={
          <button
            onClick={publishResults}
            disabled={publishing}
            style={{
              background: '#C23B2A',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: publishing ? 'wait' : 'pointer',
            }}
          >
            {publishing ? 'Publishing...' : 'Publish results'}
          </button>
        }
      />

      {/* Mobile tabs */}
      <div className="mobile-tabs" style={{ display: 'none' }}>
        <button className={`mobile-tab-btn ${mobileTab === 'students' ? 'active' : ''}`} onClick={() => setMobileTab('students')} style={{ borderBottom: mobileTab === 'students' ? '2px solid #C23B2A' : '2px solid transparent', color: mobileTab === 'students' ? '#C23B2A' : 'var(--mid-grey)' }}>
          Students
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'grade' ? 'active' : ''}`} onClick={() => setMobileTab('grade')} style={{ borderBottom: mobileTab === 'grade' ? '2px solid #C23B2A' : '2px solid transparent', color: mobileTab === 'grade' ? '#C23B2A' : 'var(--mid-grey)' }}>
          Grade
        </button>
      </div>

      <div className="grading-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Student list */}
        <div className={`grading-sidebar ${mobileTab === 'students' ? 'mobile-show' : ''}`} style={{
          width: 260,
          borderRight: '0.5px solid var(--border)',
          background: 'var(--page-bg)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '14px 16px 10px' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>{exam.title}</p>
            <div style={{ display: 'inline-block', background: 'var(--amber-light)', borderRadius: 6, padding: '4px 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>
                {submissions.filter(s => s.score == null).length} to grade
              </span>
            </div>
          </div>

          <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {submissions.map((sub) => {
            const score = computeTotalScore(sub)
            const pct = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0
            const isActive = sub.id === selectedSub
            const isGraded = sub.score != null
            const rs = sub.result_status ?? 'normal'
            const flagCount = (sub.integrity_flags ?? []).length
            const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
              disqualified: { label: 'DQ', color: 'var(--coral)', bg: 'var(--coral-light)' },
              withheld:     { label: 'WH', color: 'var(--amber)', bg: 'var(--amber-light)' },
              voided:       { label: 'VD', color: 'var(--mid-grey)', bg: 'var(--border)' },
            }
            return (
              <div
                key={sub.id}
                onClick={() => { setSelectedSub(sub.id); setMobileTab('grade') }}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: isGraded ? 'var(--teal-light)' : isActive ? 'var(--white)' : 'var(--white)',
                  borderRadius: 10,
                  boxShadow: isActive ? 'var(--shadow-soft)' : 'var(--shadow-soft)',
                  borderLeft: isActive ? '3px solid var(--coral)' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  opacity: rs !== 'normal' ? 0.6 : 1,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: isActive ? 'var(--coral)' : isGraded ? 'var(--teal)' : 'var(--border)',
                  color: isActive || isGraded ? '#fff' : 'var(--mid-grey)',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {sub.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.student_name}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {isGraded ? `Graded · ${sub.percentage ?? pct}%` : `Submitted ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' }) : ''}`}
                    </p>
                    {flagCount > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--coral)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconFlag size={10} /> {flagCount}
                      </span>
                    )}
                  </div>
                </div>
                {rs !== 'normal' && STATUS_PILL[rs] ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: STATUS_PILL[rs].color, background: STATUS_PILL[rs].bg, padding: '2px 6px', borderRadius: 4 }}>
                    {STATUS_PILL[rs].label}
                  </span>
                ) : isGraded ? (
                  <IconCheck size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                ) : (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? '#fff' : 'var(--mid-grey)',
                    background: isActive ? 'var(--coral)' : 'var(--border)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    flexShrink: 0,
                  }}>
                    Grade
                  </span>
                )}
              </div>
            )
          })}
          </div>
        </div>

        {/* Grading panel — show on desktop, only when grade tab active on mobile */}
        <div className={`grading-panel ${mobileTab === 'grade' ? 'mobile-show' : ''}`} style={{ flex: 1, flexDirection: 'column', overflow: 'hidden', display: 'flex' }}>
          {activeSub ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--near-black)' }}>{activeSub.student_name}</h2>
                    <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 2 }}>
                      Auto score: {computeAutoScore(activeSub)}/{maxMarks} pts · {exam.questions.length} questions
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: GRADE_COLORS[gradeFromPercentage(maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0)] }}>
                      {gradeFromPercentage(maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0)}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                      {computeTotalScore(activeSub)}/{maxMarks} · {maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Integrity report */}
                {(() => {
                  const flags = parseFlagEvents(activeSub.integrity_flags ?? [])
                  if (flags.length === 0) return null
                  return (
                    <div style={{ background: 'var(--coral-light)', boxShadow: '0 0 0 1.5px var(--coral)', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <IconFlag size={14} style={{ color: 'var(--coral)' }} />
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)' }}>
                          {flags.length} integrity event{flags.length > 1 ? 's' : ''} recorded during this exam
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {flags.map((f, i) => {
                          const meta = FLAG_LABELS[f.type] ?? { label: f.type, color: 'var(--mid-grey)', bg: 'var(--border)' }
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, color: 'var(--mid-grey)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 56 }}>
                                {new Date(f.at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 4 }}>
                                {meta.label}
                              </span>
                              {f.count > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>#{f.count}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, lineHeight: 1.5 }}>
                        Review these events before assigning a grade. Note your findings in the feedback field below.
                      </p>
                    </div>
                  )
                })()}

                {/* Result status controls */}
                {(() => {
                  const rs = activeSub.result_status ?? 'normal'
                  const isBusy = statusTarget === activeSub.id
                  const ACTIONS = [
                    { status: 'disqualified' as const, label: 'Disqualify', desc: 'Score set to 0. Excluded from class stats. Student is notified.', color: 'var(--coral)', bg: 'var(--coral-light)' },
                    { status: 'withheld' as const,     label: 'Withhold',   desc: 'Grade calculated but hidden from student pending review.', color: 'var(--amber)', bg: 'var(--amber-light)' },
                    { status: 'voided' as const,       label: 'Void',       desc: 'Excluded from all stats. Student sees no grade.',           color: 'var(--mid-grey)', bg: 'var(--border)' },
                  ]
                  return (
                    <div style={{ background: rs !== 'normal' ? 'var(--amber-light)' : 'var(--white)', boxShadow: rs !== 'normal' ? '0 0 0 1.5px var(--amber)' : 'var(--shadow-soft)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>Result status</p>
                        {rs !== 'normal' && (
                          <button onClick={() => setResultStatus(activeSub.id, 'normal')} disabled={isBusy} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                            Reset to normal
                          </button>
                        )}
                      </div>
                      {rs !== 'normal' && activeSub.result_note && (
                        <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10, lineHeight: 1.5 }}>Reason: {activeSub.result_note}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {ACTIONS.map(a => (
                          <button
                            key={a.status}
                            onClick={() => setResultStatus(activeSub.id, a.status)}
                            disabled={isBusy || rs === a.status}
                            title={a.desc}
                            style={{
                              background: rs === a.status ? a.bg : 'var(--white)',
                              border: `0.5px solid ${rs === a.status ? a.color : 'var(--border)'}`,
                              borderRadius: 7, padding: '7px 14px',
                              fontSize: 12, fontWeight: 700,
                              color: rs === a.status ? a.color : 'var(--near-black)',
                              cursor: isBusy || rs === a.status ? 'default' : 'pointer',
                              fontFamily: 'inherit', opacity: isBusy ? 0.6 : 1,
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={noteInput[activeSub.id] ?? activeSub.result_note ?? ''}
                        onChange={(e) => setNoteInput(prev => ({ ...prev, [activeSub.id]: e.target.value }))}
                        placeholder="Add a reason (saved with the status)"
                        rows={2}
                        style={{ width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--near-black)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  )
                })()}

                {exam.questions.map((q, qi) => {
                  const studentAnswer = activeSub.answers?.[q.id] ?? ''
                  const isAuto = q.type === 'mcq' || q.type === 'true_false'
                  const isCorrect = isAuto && studentAnswer === q.correct
                  const currentMark = manualMarks[activeSub.id]?.[q.id] ?? 0

                  return (
                    <div key={q.id} style={{
                      background: 'var(--white)',
                      boxShadow: 'var(--shadow-soft)',
                      borderRadius: 10,
                      padding: '16px 18px',
                      marginBottom: 14,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)', marginRight: 8 }}>
                            Q{qi + 1}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>
                            {q.type === 'mcq' ? 'MCQ' : q.type === 'true_false' ? 'True/False' : q.type === 'short' ? 'Short answer' : 'Essay'} · {q.marks} marks
                          </span>
                        </div>
                        {isAuto && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isCorrect ? 'var(--teal)' : 'var(--coral)',
                            background: isCorrect ? 'var(--teal-light)' : 'var(--coral-light)',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}>
                            {isCorrect ? `Auto: +${q.marks}` : 'Auto: 0'}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', marginBottom: 10, lineHeight: 1.55 }}>{q.text}</p>

                      {!isAuto && q.rubric && (
                        <div style={{ background: 'var(--amber-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid var(--amber)' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mark scheme hint</p>
                          <p style={{ fontSize: 13, color: '#9A5800', lineHeight: 1.5 }}>{q.rubric}</p>
                        </div>
                      )}

                      <div style={{
                        background: 'var(--border)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 14,
                        color: 'var(--near-black)',
                        marginBottom: isAuto ? 0 : 12,
                        lineHeight: 1.6,
                      }}>
                        {studentAnswer || <span style={{ color: 'var(--mid-grey)', fontStyle: 'italic' }}>No answer submitted</span>}
                      </div>

                      {!isAuto && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 13, color: 'var(--mid-grey)', fontWeight: 500 }}>Marks awarded</label>
                          {Array.from({ length: q.marks + 1 }, (_, m) => (
                            <button
                              key={m}
                              onClick={() => setManualMarks((prev) => ({
                                ...prev,
                                [activeSub.id]: { ...(prev[activeSub.id] ?? {}), [q.id]: m },
                              }))}
                              style={{
                                width: 36, height: 36, borderRadius: 8, border: 'none',
                                background: currentMark === m ? 'var(--teal)' : 'var(--border)',
                                color: currentMark === m ? '#fff' : 'var(--mid-grey)',
                                fontSize: 13, fontWeight: currentMark === m ? 700 : 600,
                                cursor: 'pointer',
                              }}
                            >
                              {m}
                            </button>
                          ))}
                          <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>/ {q.marks}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', marginBottom: 6 }}>Feedback for {activeSub.student_name}</p>
                  <textarea
                    value={feedback[activeSub.id] ?? ''}
                    onChange={(e) => setFeedback((prev) => ({ ...prev, [activeSub.id]: e.target.value }))}
                    placeholder="Write specific feedback that helps this student improve."
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'var(--border)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px 14px',
                      fontSize: 14,
                      color: 'var(--near-black)',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
              Select a student to begin grading
            </div>
          )}

          {/* Grade summary bar */}
          <div style={{
            borderTop: '0.5px solid var(--border)',
            background: 'var(--white)',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              Grade split
            </p>
            {['A', 'B', 'C', 'D', 'F'].map((g) => {
              const count = gradeDistribution[g] ?? 0
              const pct = submissions.length > 0 ? (count / submissions.length) * 100 : 0
              return (
                <div key={g} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: '100%', height: 32, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${Math.max(pct, 0)}%`,
                      background: GRADE_COLORS[g],
                      borderRadius: 3,
                      minHeight: count > 0 ? 4 : 0,
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GRADE_COLORS[g] }}>{g}</span>
                  <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GradingView() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mid-grey)' }}>Loading grading view...</div>}>
      <GradingViewInner />
    </Suspense>
  )
}
