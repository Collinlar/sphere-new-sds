'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import type { ExamSubmission, Exam, ExamSession } from '@/lib/types'

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: '#085041', bg: '#E1F5EE' },
  B: { text: '#185FA5', bg: '#E6F1FB' },
  C: { text: '#7A4A00', bg: '#FEF3DC' },
  D: { text: '#7A1A10', bg: '#FDECEA' },
  F: { text: '#5A5A5A', bg: '#F3F4F6' },
}

export default function StudentResultsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const [submission, setSubmission] = useState<ExamSubmission | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [session, setSession] = useState<ExamSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'pending' | 'graded'>('pending')
  const [studentEmail, setStudentEmail] = useState<string | null>(null)
  const [claimSending, setClaimSending] = useState(false)
  const [claimSent, setClaimSent] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('exam_submissions')
        .select('*, exam_sessions(*, exams(*))')
        .eq('id', id)
        .single()

      if (error || !data) { setLoading(false); return }

      setSubmission(data as ExamSubmission)
      const sessionData = (data as { exam_sessions: ExamSession & { exams: Exam } }).exam_sessions
      setSession(sessionData)
      setExam(sessionData?.exams ?? null)
      setStatus(data.score != null ? 'graded' : 'pending')

      if (data.student_id) {
        const { data: userRow } = await supabase.from('users').select('email').eq('id', data.student_id).maybeSingle()
        setStudentEmail(userRow?.email ?? null)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleClaimAccount() {
    if (!studentEmail) return
    setClaimSending(true)
    await supabase.auth.resetPasswordForEmail(studentEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    setClaimSending(false)
    setClaimSent(true)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#EFE9DD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#5A5A5A', fontSize: 14 }}>Loading your results...</p>
      </div>
    )
  }

  if (!submission || !exam) {
    return (
      <div style={{ minHeight: '100vh', background: '#EFE9DD', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>Results not found</p>
          <p style={{ fontSize: 14, color: '#5A5A5A' }}>This submission does not exist or you do not have access to it.</p>
        </div>
      </div>
    )
  }

  const resultStatus = submission.result_status ?? 'normal'

  if (resultStatus === 'disqualified') {
    return (
      <div style={{ minHeight: '100vh', background: '#EFE9DD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FDECEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✕</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>Exam disqualified</h2>
        <p style={{ fontSize: 15, color: '#5A5A5A', lineHeight: 1.65, maxWidth: 360 }}>
          Your submission for <strong>{exam.title}</strong> has been disqualified.
          {submission.result_note && <><br /><br />Reason: {submission.result_note}</>}
        </p>
        <p style={{ fontSize: 13, color: '#5A5A5A' }}>Speak to your teacher if you believe this is an error.</p>
      </div>
    )
  }

  if (resultStatus === 'withheld') {
    return (
      <div style={{ minHeight: '100vh', background: '#EFE9DD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>⏳</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>Results under review</h2>
        <p style={{ fontSize: 15, color: '#5A5A5A', lineHeight: 1.65, maxWidth: 360 }}>
          Your results for <strong>{exam.title}</strong> are currently being reviewed and have not been released yet.
        </p>
        <p style={{ fontSize: 13, color: '#5A5A5A' }}>Your teacher will let you know when they are available.</p>
      </div>
    )
  }

  if (resultStatus === 'voided') {
    return (
      <div style={{ minHeight: '100vh', background: '#EFE9DD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>—</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>Submission voided</h2>
        <p style={{ fontSize: 15, color: '#5A5A5A', lineHeight: 1.65, maxWidth: 360 }}>
          This submission has been voided and will not appear in your results.
          {submission.result_note && <><br /><br />Note: {submission.result_note}</>}
        </p>
        <p style={{ fontSize: 13, color: '#5A5A5A' }}>Speak to your teacher for more information.</p>
      </div>
    )
  }

  const gradeStyle = GRADE_COLORS[submission.grade ?? 'F'] ?? GRADE_COLORS.F
  const totalMarks = exam.questions.reduce((s, q) => s + q.marks, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#EFE9DD', fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background: status === 'graded' ? '#0A0E1A' : '#1A1A1A', padding: '28px 20px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
          {exam.subject ?? 'Exam'} · {exam.grade_level ?? ''}
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{exam.title}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {submission.student_name}
        </p>
      </div>

      {/* Pending grading state */}
      {status === 'pending' && (
        <div style={{ margin: '20px 16px' }}>
          <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF3DC', color: '#EF9F27', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              ⏳
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>Grading in progress</p>
            <p style={{ fontSize: 14, color: '#5A5A5A', lineHeight: 1.65 }}>
              Your teacher is reviewing the responses. Your results will appear here once grading is complete.
            </p>
            <div style={{ marginTop: 20, background: '#F3F4F6', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#5A5A5A' }}>Questions answered</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                {Object.keys(submission.answers ?? {}).length} of {exam.questions.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Graded state */}
      {status === 'graded' && (
        <>
          {/* Score card */}
          <div style={{ margin: '20px 16px 0' }}>
            <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '24px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: 16, background: gradeStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: gradeStyle.text }}>{submission.grade ?? 'F'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>{submission.percentage ?? 0}%</p>
                <p style={{ fontSize: 13, color: '#5A5A5A', marginTop: 4 }}>
                  {submission.score ?? 0} out of {totalMarks} marks
                </p>
                <div style={{ marginTop: 10, height: 6, background: '#EAE6DC', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${submission.percentage ?? 0}%`, height: '100%', background: gradeStyle.text, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>

            {/* Teacher feedback */}
            {submission.feedback && (
              <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '18px 20px', marginTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A5A5A', marginBottom: 8 }}>
                  Teacher feedback
                </p>
                <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7 }}>{submission.feedback}</p>
              </div>
            )}
          </div>

          {/* Per-question breakdown */}
          <div style={{ margin: '20px 16px 0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Question breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {exam.questions.map((q, qi) => {
                const studentAnswer = submission.answers?.[q.id] ?? ''
                const isAuto = q.type === 'mcq' || q.type === 'true_false'
                const isCorrect = isAuto && studentAnswer === q.correct
                const isWrong = isAuto && studentAnswer !== q.correct
                const isOpen = q.type === 'short' || q.type === 'essay'

                const correctOption = q.options?.find(o => o.label === q.correct)
                const studentOption = q.options?.find(o => o.label === studentAnswer)

                return (
                  <div key={q.id} style={{ background: '#fff', border: `0.5px solid ${isCorrect ? '#2BA888' : isWrong ? '#E05C4B' : '#E2DDD3'}`, borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A', marginRight: 8 }}>
                          Q{qi + 1}
                        </span>
                        <span style={{ fontSize: 11, color: '#5A5A5A' }}>
                          {q.type === 'mcq' ? 'Multiple choice' : q.type === 'true_false' ? 'True / False' : q.type === 'short' ? 'Short answer' : 'Essay'} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                        </span>
                      </div>
                      {isAuto && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: isCorrect ? '#085041' : '#7A1A10', background: isCorrect ? '#E1F5EE' : '#FDECEA', padding: '2px 10px', borderRadius: 4, flexShrink: 0 }}>
                          {isCorrect ? `+${q.marks}` : '0'}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.5, marginBottom: 12 }}>{q.text}</p>

                    {isAuto && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: isCorrect ? '#E1F5EE' : '#FDECEA', border: `0.5px solid ${isCorrect ? '#2BA888' : '#E05C4B'}` }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isCorrect ? '#085041' : '#7A1A10' }}>
                            Your answer:
                          </span>
                          <span style={{ fontSize: 13, color: isCorrect ? '#085041' : '#7A1A10' }}>
                            {studentOption ? `${studentOption.label}. ${studentOption.text}` : studentAnswer || 'No answer'}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 14 }}>{isCorrect ? '✓' : '✗'}</span>
                        </div>
                        {isWrong && correctOption && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#E1F5EE', border: '0.5px solid #2BA888' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#085041' }}>Correct answer:</span>
                            <span style={{ fontSize: 13, color: '#085041' }}>{correctOption.label}. {correctOption.text}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isOpen && (
                      <div>
                        <div style={{ background: '#F3F4F6', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A1A1A', lineHeight: 1.65, marginBottom: studentAnswer ? 0 : 0 }}>
                          {studentAnswer || <span style={{ color: '#5A5A5A', fontStyle: 'italic' }}>No answer submitted</span>}
                        </div>
                        {q.rubric && (
                          <div style={{ marginTop: 8, padding: '8px 12px', background: '#FEF3DC', borderRadius: 8, fontSize: 12, color: '#7A4A00' }}>
                            Marking guide: {q.rubric}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Account claim banner */}
      {studentEmail && (
        <div style={{ margin: '24px 16px 0' }}>
          <div style={{ background: '#EEEDF8', border: '0.5px solid #36318F40', borderRadius: 12, padding: '18px 20px' }}>
            {claimSent ? (
              <p style={{ fontSize: 14, color: '#1C196B', lineHeight: 1.6 }}>
                Check {studentEmail} for a link to set your password. Once set, you can sign in and see every exam you have taken.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1C196B', marginBottom: 6 }}>
                  Want to see all your results in one place?
                </p>
                <p style={{ fontSize: 13, color: '#1C196B', lineHeight: 1.6, marginBottom: 12 }}>
                  Set up a password for {studentEmail} and you will be able to sign in anytime to see every exam you have taken.
                </p>
                <button
                  onClick={handleClaimAccount}
                  disabled={claimSending}
                  style={{ background: '#36318F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: claimSending ? 'wait' : 'pointer', opacity: claimSending ? 0.7 : 1 }}
                >
                  {claimSending ? 'Sending link...' : 'Set up my account'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
