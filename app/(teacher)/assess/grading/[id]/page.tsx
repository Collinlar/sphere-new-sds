'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { ExamSession, ExamSubmission, Exam } from '@/lib/types'
import { gradeFromPercentage } from '@/lib/utils'

const GRADE_COLORS: Record<string, string> = {
  A: '#2BA888', B: '#185FA5', C: '#EF9F27', D: '#E05C4B', F: '#5A5A5A',
}

interface FlagEvent { type: string; at: string; count: number }

function parseFlagEvents(flags: string[]): FlagEvent[] {
  return flags.map(f => { try { return JSON.parse(f) as FlagEvent } catch { return null } }).filter(Boolean) as FlagEvent[]
}

const FLAG_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tab_switch:    { label: 'Switched tabs',          color: '#7A1A10', bg: '#FDECEA' },
  window_blur:   { label: 'Left the exam window',   color: '#7A4A00', bg: '#FEF3DC' },
  copy_detected: { label: 'Copied text',             color: '#7A4A00', bg: '#FEF3DC' },
  right_click:   { label: 'Right-clicked',           color: '#5A5A5A', bg: '#F3F4F6' },
  manual:        { label: 'Flagged by invigilator',  color: '#7A1A10', bg: '#FDECEA' },
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
        <p style={{ color: '#E05C4B', fontSize: 14 }}>{error ?? 'Grading session not found.'}</p>
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
          .mobile-tab-btn.active { color: #E05C4B; border-bottom: 2px solid #E05C4B; }
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
              background: '#E05C4B',
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
        <button className={`mobile-tab-btn ${mobileTab === 'students' ? 'active' : ''}`} onClick={() => setMobileTab('students')} style={{ borderBottom: mobileTab === 'students' ? '2px solid #E05C4B' : '2px solid transparent', color: mobileTab === 'students' ? '#E05C4B' : 'var(--mid-grey)' }}>
          Students
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'grade' ? 'active' : ''}`} onClick={() => setMobileTab('grade')} style={{ borderBottom: mobileTab === 'grade' ? '2px solid #E05C4B' : '2px solid transparent', color: mobileTab === 'grade' ? '#E05C4B' : 'var(--mid-grey)' }}>
          Grade
        </button>
      </div>

      <div className="grading-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Student list */}
        <div className={`grading-sidebar ${mobileTab === 'students' ? 'mobile-show' : ''}`} style={{
          width: 240,
          borderRight: '0.5px solid var(--border)',
          background: 'var(--white)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '14px 14px 8px', borderBottom: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>
              {submissions.length} students
            </p>
          </div>

          {submissions.map((sub) => {
            const score = computeTotalScore(sub)
            const pct = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0
            const grade = gradeFromPercentage(pct)
            const isActive = sub.id === selectedSub
            const rs = sub.result_status ?? 'normal'
            const flagCount = (sub.integrity_flags ?? []).length
            const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
              disqualified: { label: 'DQ', color: '#7A1A10', bg: '#FDECEA' },
              withheld:     { label: 'WH', color: '#7A4A00', bg: '#FEF3DC' },
              voided:       { label: 'VD', color: '#5A5A5A', bg: '#F3F4F6' },
            }
            return (
              <div
                key={sub.id}
                onClick={() => setSelectedSub(sub.id)}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: isActive ? '#FDECEA' : 'transparent',
                  borderBottom: '0.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  opacity: rs !== 'normal' ? 0.7 : 1,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isActive ? '#E05C4B' : 'var(--bg2)',
                  color: isActive ? '#fff' : 'var(--mid-grey)',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {sub.student_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.student_name}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{score}/{maxMarks} pts</p>
                    {flagCount > 0 && <span style={{ fontSize: 10, color: '#E05C4B', fontWeight: 700 }}>⚑ {flagCount}</span>}
                  </div>
                </div>
                {rs !== 'normal' && STATUS_PILL[rs] ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: STATUS_PILL[rs].color, background: STATUS_PILL[rs].bg, padding: '2px 6px', borderRadius: 4 }}>
                    {STATUS_PILL[rs].label}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: GRADE_COLORS[grade] ?? 'var(--mid-grey)' }}>
                    {grade}
                  </span>
                )}
              </div>
            )
          })}
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
                      Auto score: {computeAutoScore(activeSub)}/{maxMarks} pts
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: GRADE_COLORS[gradeFromPercentage(maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0)] }}>
                      {gradeFromPercentage(maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0)}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                      {maxMarks > 0 ? Math.round((computeTotalScore(activeSub) / maxMarks) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Integrity report */}
                {(() => {
                  const flags = parseFlagEvents(activeSub.integrity_flags ?? [])
                  if (flags.length === 0) return null
                  return (
                    <div style={{ background: '#FDECEA', border: '0.5px solid #E05C4B', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 14 }}>⚑</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#7A1A10' }}>
                          {flags.length} integrity event{flags.length > 1 ? 's' : ''} recorded during this exam
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {flags.map((f, i) => {
                          const meta = FLAG_LABELS[f.type] ?? { label: f.type, color: '#5A5A5A', bg: '#F3F4F6' }
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, color: '#5A5A5A', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 56 }}>
                                {new Date(f.at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 4 }}>
                                {meta.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <p style={{ fontSize: 12, color: '#7A1A10', marginTop: 12, lineHeight: 1.5 }}>
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
                    { status: 'disqualified' as const, label: 'Disqualify', desc: 'Score set to 0. Excluded from class stats. Student is notified.', color: '#E05C4B', bg: '#FDECEA' },
                    { status: 'withheld' as const,     label: 'Withhold',   desc: 'Grade calculated but hidden from student pending review.', color: '#EF9F27', bg: '#FEF3DC' },
                    { status: 'voided' as const,       label: 'Void',       desc: 'Excluded from all stats. Student sees no grade.',           color: '#5A5A5A', bg: '#F3F4F6' },
                  ]
                  return (
                    <div style={{ background: rs !== 'normal' ? '#FEF3DC' : 'var(--page-bg)', border: `0.5px solid ${rs !== 'normal' ? '#EF9F27' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>Result status</p>
                        {rs !== 'normal' && (
                          <button onClick={() => setResultStatus(activeSub.id, 'normal')} disabled={isBusy} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                            Reset to normal
                          </button>
                        )}
                      </div>
                      {rs !== 'normal' && activeSub.result_note && (
                        <p style={{ fontSize: 12, color: '#7A4A00', marginBottom: 10, lineHeight: 1.5 }}>Reason: {activeSub.result_note}</p>
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
                        style={{ width: '100%', background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--near-black)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
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
                      border: '0.5px solid var(--border)',
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
                            color: isCorrect ? '#085041' : '#7A1A10',
                            background: isCorrect ? '#E1F5EE' : '#FDECEA',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}>
                            {isCorrect ? `+${q.marks}` : '0'}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', marginBottom: 10 }}>{q.text}</p>

                      <div style={{
                        background: 'var(--bg2)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 14,
                        color: 'var(--near-black)',
                        marginBottom: isAuto ? 0 : 12,
                      }}>
                        {studentAnswer || <span style={{ color: 'var(--mid-grey)', fontStyle: 'italic' }}>No answer submitted</span>}
                      </div>

                      {!isAuto && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                          <label style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Marks awarded</label>
                          <input
                            type="number"
                            min={0}
                            max={q.marks}
                            value={currentMark}
                            onChange={(e) => setManualMarks((prev) => ({
                              ...prev,
                              [activeSub.id]: { ...(prev[activeSub.id] ?? {}), [q.id]: Number(e.target.value) },
                            }))}
                            style={{
                              background: 'var(--bg2)',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 10px',
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--near-black)',
                              width: 64,
                              fontFamily: 'inherit',
                            }}
                          />
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
                      background: 'var(--bg2)',
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
