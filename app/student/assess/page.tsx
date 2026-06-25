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
  A: '#085041', B: '#185FA5', C: '#7A4A00', D: '#7A1A10', F: '#5A5A5A',
}
const GRADE_BG: Record<string, string> = {
  A: '#E1F5EE', B: '#E6F1FB', C: '#FEF3DC', D: '#FDECEA', F: '#F3F4F6',
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
    <div style={{ minHeight: '100vh', background: '#EFE9DD', fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ background: '#0A0E1A', padding: '28px 20px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Exams</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Your submitted exams and results</p>
      </div>

      {/* Join an exam */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 10 }}>Join an exam</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter exam code"
              maxLength={9}
              style={{ flex: 1, background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', outline: 'none', fontFamily: 'inherit' }}
            />
            <Link href={`/student/assess/${joinCode}`}>
              <button
                disabled={joinCode.length < 4}
                style={{ background: joinCode.length >= 4 ? '#E05C4B' : '#E2DDD3', color: joinCode.length >= 4 ? '#fff' : '#B0A898', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: joinCode.length >= 4 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                Join exam
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Past submissions */}
      <div style={{ margin: '20px 16px 0' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Past exams
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#5A5A5A', fontSize: 14 }}>
            Loading your exam history...
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '36px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#5A5A5A' }}>No exams yet. Enter a code above to join one.</p>
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
                <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: isGraded ? (GRADE_BG[grade] ?? '#F3F4F6') : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isGraded ? (
                      <span style={{ fontSize: 24, fontWeight: 800, color: GRADE_COLORS[grade] ?? '#5A5A5A' }}>{grade}</span>
                    ) : (
                      <span style={{ fontSize: 20 }}>📝</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {examData?.title ?? 'Exam'}
                    </p>
                    <p style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>
                      {examData?.subject ?? ''}{examData?.grade_level ? ` · ${examData.grade_level}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {isGraded ? (
                      <>
                        <p style={{ fontSize: 18, fontWeight: 700, color: GRADE_COLORS[grade] ?? '#5A5A5A' }}>{sub.percentage ?? 0}%</p>
                        <p style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>{sub.score} marks</p>
                      </>
                    ) : isPending ? (
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#7A4A00', background: '#FEF3DC', padding: '4px 10px', borderRadius: 6 }}>Being graded</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#5A5A5A' }}>Submitted</span>
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
