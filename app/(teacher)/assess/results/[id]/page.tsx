'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/brand/TopBar'
import type { Exam, ExamSession, ExamSubmission } from '@/lib/types'
import { gradeFromPercentage } from '@/lib/utils'
import Link from 'next/link'

const GRADE_COLORS: Record<string, string> = {
  A: '#1A8966', B: '#1052A3', C: '#D97010', D: '#C23B2A', F: '#6B6870',
}
const GRADE_BG: Record<string, string> = {
  A: '#DDFAF0', B: '#E3EDFB', C: '#FEF0DC', D: '#FDECEA', F: '#EDECE9',
}

export default function SessionResultsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const [session, setSession] = useState<ExamSession | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*, exams(*), exam_submissions(*)')
        .eq('id', id)
        .single()

      if (error || !data) { setLoading(false); return }
      setSession(data as ExamSession)
      setExam((data as { exams: Exam }).exams)
      const subs = (data as { exam_submissions: ExamSubmission[] }).exam_submissions ?? []
      setSubmissions(subs.filter(s => s.submitted_at))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ height: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
        Loading results...
      </div>
    )
  }

  if (!session || !exam) {
    return (
      <div style={{ height: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#C23B2A', fontSize: 14 }}>Results not found.</p>
      </div>
    )
  }

  // Disqualified and voided are excluded from class statistics
  const gradedSubs = submissions.filter(s => s.score != null && !['disqualified', 'voided'].includes(s.result_status ?? 'normal'))
  const maxMarks = exam.questions.reduce((s, q) => s + q.marks, 0)
  const avgPct = gradedSubs.length > 0
    ? Math.round(gradedSubs.reduce((s, sub) => s + (sub.percentage ?? 0), 0) / gradedSubs.length)
    : null
  const highest = gradedSubs.length > 0 ? Math.max(...gradedSubs.map(s => s.percentage ?? 0)) : null
  const lowest = gradedSubs.length > 0 ? Math.min(...gradedSubs.map(s => s.percentage ?? 0)) : null

  const gradeDist = ['A', 'B', 'C', 'D', 'F'].map(g => ({
    grade: g,
    count: gradedSubs.filter(s => (s.grade ?? gradeFromPercentage(s.percentage ?? 0)) === g).length,
  }))

  const isGraded = session.status === 'completed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--page-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .results-container { padding: 16px 16px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div { padding: 14px 16px !important; }
          .results-layout { grid-template-columns: 1fr !important; }
          .grade-dist { display: none; }
          .results-table { overflow-x: auto; }
          .results-table table { font-size: 13px; }
          .results-table th, .results-table td { padding: 10px 12px !important; }
        }
        @media (max-width: 480px) {
          .results-container { padding: 12px 12px !important; }
          .session-meta { flex-direction: column; gap: 8px; font-size: 11px; }
          .session-meta span:last-child { margin-left: 0 !important; }
          .stats-grid { grid-template-columns: 1fr; gap: 10px; }
          .stats-grid > div p:first-child { font-size: 10px; }
          .stats-grid > div p:last-child { font-size: 20px; }
          .results-table table thead { display: none; }
          .results-table table tbody tr { display: block; border: 0.5px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
          .results-table table td { display: flex; justify-content: space-between; padding: 6px 0 !important; border: none; }
          .results-table table td::before { content: attr(data-label); font-weight: 600; color: var(--mid-grey); min-width: 80px; }
        }
      `}</style>
      <TopBar
        mode="assess"
        title={`Results: ${exam.title}`}
        right={
          !isGraded ? (
            <Link href={`/assess/grading/${id}`}>
              <button style={{ background: '#D97010', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                Go to grading
              </button>
            </Link>
          ) : undefined
        }
      />

      <div className="results-container" style={{ padding: '28px 32px', maxWidth: 1000, width: '100%' }}>

        {/* Session meta */}
        <div className="session-meta" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
            {exam.subject ?? ''}{exam.grade_level ? ` · ${exam.grade_level}` : ''} · {exam.questions.length} questions · {maxMarks} marks · {exam.duration_minutes} min
          </span>
          {session.scheduled_at && (
            <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
              · {new Date(session.scheduled_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            color: isGraded ? '#1A8966' : '#D97010',
            background: isGraded ? '#DDFAF0' : '#FEF0DC',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {isGraded ? 'Graded' : 'Pending grading'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--mid-grey)', marginLeft: 'auto' }}>
            Join code: <strong style={{ letterSpacing: '0.1em', color: 'var(--near-black)' }}>{session.join_code}</strong>
          </span>
        </div>

        {!isGraded && (
          <div style={{ background: '#FEF0DC', border: '0.5px solid #D97010', borderRadius: 10, padding: '14px 20px', marginBottom: 28, fontSize: 14, color: '#D97010' }}>
            Grading has not been published yet. Scores and grades below will not be visible to students until you publish.
          </div>
        )}

        {/* Summary stats */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Students', value: submissions.length },
            { label: 'Class average', value: avgPct != null ? `${avgPct}%` : 'Not graded' },
            { label: 'Highest score', value: highest != null ? `${highest}%` : 'N/A' },
            { label: 'Lowest score', value: lowest != null ? `${lowest}%` : 'N/A' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--mid-grey)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1.1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="results-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' }}>
          {/* Grade distribution */}
          <div className="grade-dist" style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '20px 20px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 18 }}>Grade distribution</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gradeDist.map(({ grade, count }) => {
                const pct = submissions.length > 0 ? (count / submissions.length) * 100 : 0
                return (
                  <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 6, background: GRADE_BG[grade], color: GRADE_COLORS[grade], fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {grade}
                    </span>
                    <div style={{ flex: 1, height: 8, background: 'var(--page-bg)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: GRADE_COLORS[grade], borderRadius: 4, minWidth: count > 0 ? 4 : 0 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? GRADE_COLORS[grade] : 'var(--mid-grey)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Student results table */}
          <div className="results-table" style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}</p>
              {!isGraded && submissions.length > 0 && (
                <Link href={`/assess/grading/${id}`}>
                  <button style={{ background: '#FEF0DC', border: '0.5px solid #D97010', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#D97010', cursor: 'pointer' }}>
                    Grade now
                  </button>
                </Link>
              )}
            </div>

            {submissions.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                No submissions were recorded for this session.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                    {['Student', 'Score', 'Percentage', 'Grade / Status', 'Feedback', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--mid-grey)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions
                    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
                    .map((sub, idx, arr) => {
                      const grade = sub.grade ?? (sub.percentage != null ? gradeFromPercentage(sub.percentage) : null)
                      const rs = sub.result_status ?? 'normal'
                      const isAffected = rs !== 'normal'

                      const RS_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
                        disqualified: { label: 'Disqualified', color: '#C23B2A', bg: '#FDECEA', desc: 'Excluded from class stats. Student notified.' },
                        withheld:     { label: 'Withheld',     color: '#D97010', bg: '#FEF0DC', desc: 'Results hidden from student pending review.' },
                        voided:       { label: 'Voided',       color: '#6B6870', bg: '#EDECE9', desc: 'Excluded from all stats. No grade shown.' },
                      }
                      const rsMeta = RS_META[rs]

                      return (
                        <tr key={sub.id} style={{
                          borderBottom: idx < arr.length - 1 ? '0.5px solid var(--border)' : 'none',
                          background: isAffected ? (rs === 'disqualified' ? '#FFF8F8' : rs === 'withheld' ? '#FFFBF5' : '#FAFAFA') : 'transparent',
                          opacity: isAffected ? 0.85 : 1,
                        }}>
                          {/* Student */}
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: isAffected ? (rsMeta?.bg ?? 'var(--page-bg)') : 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: isAffected ? (rsMeta?.color ?? 'var(--mid-grey)') : 'var(--mid-grey)', flexShrink: 0 }}>
                                {sub.student_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{sub.student_name}</span>
                                {sub.result_note && (
                                  <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 2 }}>Note: {sub.result_note}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td style={{ padding: '13px 16px', fontSize: 14, color: isAffected ? 'var(--mid-grey)' : 'var(--near-black)' }}>
                            {sub.score != null ? `${sub.score} / ${maxMarks}` : <span style={{ color: 'var(--mid-grey)' }}>—</span>}
                          </td>

                          {/* Percentage */}
                          <td style={{ padding: '13px 16px' }}>
                            {sub.percentage != null && !isAffected ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 60, height: 5, background: 'var(--page-bg)', borderRadius: 3, flexShrink: 0 }}>
                                  <div style={{ width: `${sub.percentage}%`, height: '100%', background: grade ? GRADE_COLORS[grade] : 'var(--mid-grey)', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{sub.percentage}%</span>
                              </div>
                            ) : <span style={{ color: 'var(--mid-grey)', fontSize: 13 }}>—</span>}
                          </td>

                          {/* Grade / Status */}
                          <td style={{ padding: '13px 16px' }}>
                            {isAffected && rsMeta ? (
                              <div>
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: rsMeta.color, background: rsMeta.bg, padding: '3px 9px', borderRadius: 5, display: 'inline-block' }}>
                                  {rsMeta.label}
                                </span>
                                <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 4, lineHeight: 1.4 }}>{rsMeta.desc}</p>
                              </div>
                            ) : grade ? (
                              <span style={{ fontSize: 14, fontWeight: 800, color: GRADE_COLORS[grade], background: GRADE_BG[grade], padding: '3px 10px', borderRadius: 5 }}>
                                {grade}
                              </span>
                            ) : <span style={{ color: 'var(--mid-grey)', fontSize: 13 }}>—</span>}
                          </td>

                          {/* Feedback */}
                          <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--mid-grey)', maxWidth: 180 }}>
                            {sub.feedback
                              ? <span style={{ color: 'var(--near-black)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sub.feedback}</span>
                              : '—'}
                          </td>

                          {/* Action */}
                          <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                            <Link href={`/assess/grading/${id}?student=${sub.id}`}>
                              <button style={{ background: 'var(--page-bg)', boxShadow: 'var(--shadow-soft)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: isAffected ? rsMeta?.color ?? 'var(--near-black)' : 'var(--near-black)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                {isAffected ? 'Review' : 'Edit'}
                              </button>
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
