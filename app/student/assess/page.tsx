'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'

interface SubmissionRow {
  id: string
  student_name: string
  submitted_at: string | null
  score: number | null
  percentage: number | null
  grade: string | null
  exam_sessions: {
    status: string
    exams: { title: string; subject: string | null; grade_level: string | null; duration_minutes: number }
  }
}

const GRADE_COLORS: Record<string, string> = {
  A: '#1A8966', B: '#1052A3', C: '#D97010', D: '#C23B2A', F: '#6B6870',
}
const GRADE_BG: Record<string, string> = {
  A: '#DDFAF0', B: '#E3EDFB', C: '#FEF0DC', D: '#FDECEA', F: '#EDECE9',
}

export default function StudentAssessPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('exam_submissions')
        .select('id, student_name, submitted_at, score, percentage, grade, exam_sessions(status, exams(title, subject, grade_level, duration_minutes))')
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false })
      setSubmissions((data ?? []) as unknown as SubmissionRow[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F1', fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ background: '#0C1021', padding: '28px 20px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Exams</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Your submitted exams and results</p>
      </div>

      {/* Join an exam */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#18171A', marginBottom: 10 }}>Join an exam</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter exam code"
              maxLength={9}
              style={{ flex: 1, background: '#EDECE9', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', outline: 'none', fontFamily: 'inherit' }}
            />
            <Link href={`/student/assess/${joinCode}`}>
              <button
                disabled={joinCode.length < 4}
                style={{ background: joinCode.length >= 4 ? '#C23B2A' : '#EDECE9', color: joinCode.length >= 4 ? '#fff' : '#B0A898', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: joinCode.length >= 4 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                Join exam
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Past submissions */}
      <div style={{ margin: '20px 16px 0' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, paddingLeft: 4 }}>
          Past exams
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B6870', fontSize: 14 }}>
            Loading your exam history...
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '36px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#6B6870' }}>No exams yet. Enter a code above to join one.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {submissions.map(sub => {
            const examData = sub.exam_sessions?.exams
            const sessionStatus = sub.exam_sessions?.status
            const isGraded = sub.score != null
            const isPending = !isGraded && sessionStatus === 'grading'
            const grade = sub.grade ?? 'F'

            return (
              <Link key={sub.id} href={`/student/assess/results/${sub.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: isGraded ? (GRADE_BG[grade] ?? '#EDECE9') : '#EDECE9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isGraded ? (
                      <span style={{ fontSize: 24, fontWeight: 800, color: GRADE_COLORS[grade] ?? '#6B6870' }}>{grade}</span>
                    ) : (
                      <span style={{ fontSize: 20 }}>📝</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#18171A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {examData?.title ?? 'Exam'}
                    </p>
                    <p style={{ fontSize: 12, color: '#6B6870', marginTop: 2 }}>
                      {examData?.subject ?? ''}{examData?.grade_level ? ` · ${examData.grade_level}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {isGraded ? (
                      <>
                        <p style={{ fontSize: 18, fontWeight: 700, color: GRADE_COLORS[grade] ?? '#6B6870' }}>{sub.percentage ?? 0}%</p>
                        <p style={{ fontSize: 11, color: '#6B6870', marginTop: 2 }}>{sub.score} marks</p>
                      </>
                    ) : isPending ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9A5800', background: '#FEF0DC', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>Being graded</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#6B6870' }}>Submitted</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
