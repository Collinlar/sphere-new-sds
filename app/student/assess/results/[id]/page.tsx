'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import type { ExamSubmission, Exam, ExamSession } from '@/lib/types'
import { IconCheck, IconXCircle, IconInfo } from '@/components/icons'
import { shouldOfferAccountSetup } from '@/lib/assess-account'
import GuestClaimBanner from '@/components/brand/GuestClaimBanner'

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: 'var(--teal)', bg: 'var(--teal-light)' },
  B: { text: 'var(--blue)', bg: 'var(--blue-light)' },
  C: { text: 'var(--amber)', bg: 'var(--amber-light)' },
  D: { text: 'var(--coral)', bg: 'var(--coral-light)' },
  F: { text: 'var(--mid-grey)', bg: 'var(--border)' },
}

function GradingPendingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="var(--amber)" strokeWidth="1.5" />
      <path d="M14 8v6" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 22l4-6 4 6" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function StudentResultsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const [submission, setSubmission] = useState<ExamSubmission | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [session, setSession] = useState<ExamSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'pending' | 'graded'>('pending')
  const [studentEmail, setStudentEmail] = useState<string | null>(null)
  const [showAccountSetup, setShowAccountSetup] = useState(false)
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

      const submissionData = data as ExamSubmission
      const sessionData = (data as { exam_sessions: ExamSession & { exams: Exam } }).exam_sessions
      const examData = sessionData?.exams ?? null

      setSubmission(submissionData)
      setSession(sessionData)
      setExam(examData)
      setStatus(data.score != null ? 'graded' : 'pending')

      let email: string | null = null
      if (data.student_id) {
        const { data: userRow } = await supabase.from('users').select('email').eq('id', data.student_id).maybeSingle()
        email = userRow?.email ?? null
        setStudentEmail(email)
      }

      const { data: authData } = await supabase.auth.getSession()
      setShowAccountSetup(shouldOfferAccountSetup(submissionData, examData, email, authData.session?.user?.id))

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

  const accountUpsell = showAccountSetup && studentEmail ? (
    <div style={{ margin: status === 'pending' ? 0 : '14px 0 0', background: 'var(--blue-light)', borderRadius: 12, padding: status === 'pending' ? 20 : 16, border: '0.5px solid rgba(16,82,163,0.15)' }}>
      {claimSent ? (
        <p style={{ fontSize: 14, color: 'var(--blue)', lineHeight: 1.6 }}>
          Check {studentEmail} for a link to set your password. Once set, you can sign in and see every exam you have taken.
        </p>
      ) : (
        <>
          <p style={{ fontSize: status === 'pending' ? 14 : 13, fontWeight: 600, color: 'var(--blue)', marginBottom: status === 'pending' ? 6 : 5 }}>
            {status === 'pending' ? 'Want to see all your results in one place?' : 'See all your results in one place'}
          </p>
          <p style={{ fontSize: status === 'pending' ? 13 : 12, color: 'var(--mid-grey)', lineHeight: 1.55, marginBottom: status === 'pending' ? 16 : 12 }}>
            {status === 'pending'
              ? 'Set up a password and sign in anytime to view every exam you have taken, with full breakdowns.'
              : 'Create an account to track every exam you have taken with full score history.'}
          </p>
          <button
            onClick={handleClaimAccount}
            disabled={claimSending}
            style={{
              width: '100%',
              height: status === 'pending' ? 44 : 40,
              background: 'var(--blue)',
              color: '#fff',
              border: 'none',
              borderRadius: status === 'pending' ? 9 : 8,
              fontSize: status === 'pending' ? 14 : 13,
              fontWeight: 600,
              cursor: claimSending ? 'wait' : 'pointer',
              opacity: claimSending ? 0.7 : 1,
            }}
          >
            {claimSending ? 'Sending link...' : 'Set up my account'}
          </button>
        </>
      )}
    </div>
  ) : null

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Loading your results...</p>
      </div>
    )
  }

  if (!submission || !exam) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Results not found</p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This submission does not exist or you do not have access to it.</p>
        </div>
      </div>
    )
  }

  const resultStatus = submission.result_status ?? 'normal'

  if (resultStatus === 'disqualified') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--coral-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)' }}>
          <IconXCircle size={32} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>Exam disqualified</h2>
        <p style={{ fontSize: 15, color: 'var(--mid-grey)', lineHeight: 1.65, maxWidth: 360 }}>
          Your submission for <strong>{exam.title}</strong> has been disqualified.
          {submission.result_note && <><br /><br />Reason: {submission.result_note}</>}
        </p>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Speak to your teacher if you believe this is an error.</p>
      </div>
    )
  }

  if (resultStatus === 'withheld') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GradingPendingIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>Results under review</h2>
        <p style={{ fontSize: 15, color: 'var(--mid-grey)', lineHeight: 1.65, maxWidth: 360 }}>
          Your results for <strong>{exam.title}</strong> are currently being reviewed and have not been released yet.
        </p>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Your teacher will let you know when they are available.</p>
      </div>
    )
  }

  if (resultStatus === 'voided') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid-grey)' }}>
          <IconInfo size={28} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>Submission voided</h2>
        <p style={{ fontSize: 15, color: 'var(--mid-grey)', lineHeight: 1.65, maxWidth: 360 }}>
          This submission has been voided and will not appear in your results.
          {submission.result_note && <><br /><br />Note: {submission.result_note}</>}
        </p>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Speak to your teacher for more information.</p>
      </div>
    )
  }

  const gradeStyle = GRADE_COLORS[submission.grade ?? 'F'] ?? GRADE_COLORS.F
  const totalMarks = exam.questions.reduce((s, q) => s + q.marks, 0)
  const answeredCount = Object.keys(submission.answers ?? {}).filter((k) => (submission.answers[k] ?? '').trim() !== '').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', maxWidth: 520, margin: '0 auto', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '22px 22px 20px' }}>
        {status === 'pending' && (
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 5, textTransform: 'uppercase' }}>
            {exam.subject ?? 'Exam'}{exam.grade_level ? ` · ${exam.grade_level}` : ''}
          </p>
        )}
        <h1 style={{ fontSize: status === 'pending' ? 22 : 22, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{exam.title}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {status === 'pending' ? 'Exam submitted' : 'Results released'}
        </p>
      </div>

      <div style={{ padding: status === 'pending' ? '28px 20px 24px' : '20px 20px 24px' }}>

        {/* Pending grading state */}
        {status === 'pending' && (
          <>
            <GuestClaimBanner sessionType="exam" submissionId={id} />
            <div style={{ background: 'var(--white)', borderRadius: 14, padding: '28px 20px', boxShadow: 'var(--shadow-soft)', textAlign: 'center', marginBottom: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--amber-light)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GradingPendingIcon />
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>Grading in progress</p>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.65, marginBottom: 20 }}>
                Your teacher is reviewing your responses. Results will appear here once grading is complete.
              </p>
              <div style={{ background: 'var(--border)', borderRadius: 9, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Questions answered</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>
                  {answeredCount} of {exam.questions.length}
                </span>
              </div>
            </div>
            {accountUpsell}
          </>
        )}

        {/* Graded state */}
        {status === 'graded' && (
          <>
            <GuestClaimBanner sessionType="exam" submissionId={id} />
            {/* Score card */}
            <div style={{ background: 'var(--white)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow-soft)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: gradeStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: gradeStyle.text }}>{submission.grade ?? 'F'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{submission.percentage ?? 0}%</p>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {submission.score ?? 0} out of {totalMarks} marks
                </p>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${submission.percentage ?? 0}%`, height: '100%', background: gradeStyle.text, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>

            {submission.feedback && (
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mid-grey)', marginBottom: 8 }}>
                  Teacher feedback
                </p>
                <p style={{ fontSize: 14, color: 'var(--near-black)', lineHeight: 1.7 }}>{submission.feedback}</p>
              </div>
            )}

            {/* Per-question breakdown */}
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Question breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
              {exam.questions.map((q, qi) => {
                const studentAnswer = submission.answers?.[q.id] ?? ''
                const isAuto = q.type === 'mcq' || q.type === 'true_false'
                const isOpen = q.type === 'short' || q.type === 'essay'
                const isCorrect = isAuto && studentAnswer === q.correct
                const isWrong = isAuto && studentAnswer !== q.correct

                const correctOption = q.options?.find(o => o.label === q.correct)
                const studentOption = q.options?.find(o => o.label === studentAnswer)

                const borderColor = isCorrect ? 'var(--teal)' : isWrong ? 'var(--coral)' : 'var(--border)'

                return (
                  <div key={q.id} style={{ background: 'var(--white)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-soft)', borderLeft: `3px solid ${borderColor}` }}>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Q{qi + 1}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {q.type === 'mcq' ? 'Multiple choice' : q.type === 'true_false' ? 'True / False' : q.type === 'short' ? 'Short answer' : 'Essay'} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>
                        </div>
                        {isAuto && isCorrect && (
                          <div style={{ background: 'var(--teal-light)', borderRadius: 20, padding: '3px 10px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>+{q.marks}</span>
                          </div>
                        )}
                        {isAuto && isWrong && (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--coral-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)' }}>0</span>
                          </div>
                        )}
                        {isOpen && (
                          <div style={{ background: 'var(--amber-light)', borderRadius: 20, padding: '3px 10px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>Pending</span>
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', lineHeight: 1.4, marginBottom: 10 }}>{q.text}</p>

                      {isAuto && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{
                            background: isCorrect ? 'var(--teal-light)' : 'var(--coral-light)',
                            borderRadius: 7,
                            padding: '9px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: isWrong ? 6 : 0,
                          }}>
                            <span style={{ fontSize: 13, color: isCorrect ? 'var(--teal)' : 'var(--coral)', fontWeight: isCorrect ? 600 : 400 }}>
                              {studentOption ? `${studentOption.label}. ${studentOption.text}` : studentAnswer || 'No answer'}
                            </span>
                            {isCorrect ? (
                              <IconCheck size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                            ) : (
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral)', flexShrink: 0 }}>×</span>
                            )}
                          </div>
                          {isWrong && correctOption && (
                            <div style={{ background: 'var(--teal-light)', borderRadius: 7, padding: '9px 12px' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Correct: {correctOption.label}. {correctOption.text}</span>
                            </div>
                          )}
                          {q.explanation && (
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--border)', fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.55 }}>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}

                      {isOpen && (
                        <div style={{ background: 'var(--border)', borderRadius: 7, padding: '9px 12px' }}>
                          <span style={{ fontSize: 13, color: studentAnswer ? 'var(--mid-grey)' : 'var(--text-tertiary)', fontStyle: studentAnswer ? 'normal' : 'italic' }}>
                            {studentAnswer || 'No answer submitted'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {accountUpsell}
          </>
        )}
      </div>
    </div>
  )
}
