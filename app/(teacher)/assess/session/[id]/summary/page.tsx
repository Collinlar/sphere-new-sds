'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Exam, ExamSession, ExamSubmission } from '@/lib/types'
import Link from 'next/link'

export default function SessionSummaryPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const router = useRouter()

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
      setSubmissions((data as { exam_submissions: ExamSubmission[] }).exam_submissions ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading session summary...</p>
      </div>
    )
  }

  if (!session || !exam) {
    return (
      <div style={{ height: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#E05C4B', fontSize: 14 }}>Session not found.</p>
      </div>
    )
  }

  const totalJoined = submissions.length
  const submitted = submissions.filter(s => s.submitted_at).length
  const inProgress = submissions.filter(s => !s.submitted_at).length
  const flagged = submissions.filter(s => s.integrity_flags?.length > 0).length

  const startedAt = session.scheduled_at ? new Date(session.scheduled_at) : null
  const endedAt = new Date()
  const durationMins = startedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000) : exam.duration_minutes

  const statCards = [
    { label: 'Students joined', value: totalJoined, color: '#fff' },
    { label: 'Submitted', value: submitted, color: '#2BA888' },
    { label: 'Did not submit', value: inProgress, color: inProgress > 0 ? '#EF9F27' : 'rgba(255,255,255,0.4)' },
    { label: 'Flagged', value: flagged, color: flagged > 0 ? '#E05C4B' : 'rgba(255,255,255,0.4)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '32px 48px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>
          Session ended
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{exam.title}</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          {exam.subject ?? ''}{exam.grade_level ? ` · ${exam.grade_level}` : ''} · {exam.questions.length} questions · {exam.duration_minutes} min
        </p>
      </div>

      {/* Stat grid */}
      <div style={{ padding: '48px 48px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '24px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 48, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Session meta */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px', marginBottom: 48, display: 'flex', gap: 40 }}>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Join code</p>
            <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.15em', color: '#E05C4B' }}>{session.join_code}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Session ran</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{durationMins} min</p>
          </div>
          {startedAt && (
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Started at</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {startedAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Submission rate</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: totalJoined > 0 ? '#2BA888' : 'rgba(255,255,255,0.4)' }}>
              {totalJoined > 0 ? `${Math.round((submitted / totalJoined) * 100)}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Notice — no student data shown */}
        {flagged > 0 && (
          <div style={{ background: 'rgba(224,92,75,0.1)', border: '0.5px solid rgba(224,92,75,0.3)', borderRadius: 10, padding: '14px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚑</span>
            <p style={{ fontSize: 14, color: '#F8A49A' }}>
              {flagged} submission{flagged > 1 ? 's were' : ' was'} flagged for integrity issues. Review them during grading.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 'auto', padding: '32px 48px', borderTop: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/assess" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          Back to Assess
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          {submitted === 0 && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', alignSelf: 'center' }}>
              No submissions to grade yet.
            </p>
          )}
          {submitted > 0 && (
            <button
              onClick={() => router.push(`/assess/grading/${id}`)}
              style={{ background: '#E05C4B', border: 'none', borderRadius: 10, padding: '14px 36px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Begin grading {submitted} {submitted === 1 ? 'submission' : 'submissions'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
