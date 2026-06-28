'use client'

import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import ProgressTrack from '@/components/ui/ProgressTrack'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface SubjectRow {
  subject: string
  pct: number
}

interface ScorePoint {
  date: string
  score: number
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function ScoreSparkline({ points }: { points: ScorePoint[] }) {
  const width = 320
  const height = 72
  const padX = 8
  const padY = 8

  if (points.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No exam scores recorded yet.</p>
    )
  }

  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const xStep = sorted.length > 1 ? (width - padX * 2) / (sorted.length - 1) : 0

  const coords = sorted.map((p, i) => {
    const x = padX + i * xStep
    const y = padY + (1 - p.score / 100) * (height - padY * 2)
    return `${x},${y}`
  }).join(' ')

  const areaCoords = `${padX},${height - padY} ${coords} ${padX + (sorted.length - 1) * xStep},${height - padY}`

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {[25, 50, 75].map(mark => {
          const y = padY + (1 - mark / 100) * (height - padY * 2)
          return (
            <line
              key={mark}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="var(--bg2)"
              strokeWidth="1"
            />
          )
        })}
        <polygon points={areaCoords} fill="var(--teal-light)" opacity={0.6} />
        <polyline points={coords} fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p, i) => {
          const x = padX + i * xStep
          const y = padY + (1 - p.score / 100) * (height - padY * 2)
          return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--teal)" />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {new Date(sorted[0].date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}

export default function StudentAnalyticsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [initials, setInitials] = useState('??')
  const [email, setEmail] = useState<string | null>(null)
  const [yearSubject, setYearSubject] = useState('')

  const [overallAvg, setOverallAvg] = useState<string>('-')
  const [attendanceProxy, setAttendanceProxy] = useState<string>('-')
  const [assignments, setAssignments] = useState<string>('-')
  const [engageRank, setEngageRank] = useState<string>('-')
  const [trainProgress, setTrainProgress] = useState<string>('-')

  const [scorePoints, setScorePoints] = useState<ScorePoint[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])

  const exportReport = useCallback(() => {
    const lines = [
      `Student report: ${name}`,
      yearSubject ? `Class: ${yearSubject}` : '',
      '',
      `Overall average: ${overallAvg}`,
      `Attendance proxy: ${attendanceProxy}`,
      `Assignments completed: ${assignments}`,
      `Engage rank: ${engageRank}`,
      `Train progress: ${trainProgress}`,
      '',
      'Subject breakdown:',
      ...subjects.map(s => `  ${s.subject}: ${s.pct}%`),
      '',
      'Exam scores:',
      ...scorePoints.map(p => `  ${p.date}: ${p.score}%`),
    ].filter(Boolean)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-report.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [name, yearSubject, overallAvg, attendanceProxy, assignments, engageRank, trainProgress, subjects, scorePoints])

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      const iid = user.institution_id
      if (!iid) { setLoading(false); return }

      const { data: student } = await supabase
        .from('users')
        .select('id, name, email, avatar_initials, institution_id, role')
        .eq('id', id)
        .single()

      if (!student || student.institution_id !== iid || student.role !== 'student') {
        setNotFound(true)
        setLoading(false)
        return
      }

      setName(student.name)
      setInitials(student.avatar_initials || student.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase())
      setEmail(student.email ?? null)

      const [enrollRes, submissionRes, pathRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('progress_percentage, enrolled_at, completed_modules, courses(subject, grade_level)')
          .eq('student_id', id),
        supabase
          .from('exam_submissions')
          .select('percentage, submitted_at, exam_sessions(exams(subject))')
          .eq('student_id', id)
          .not('percentage', 'is', null)
          .order('submitted_at', { ascending: true }),
        supabase
          .from('path_enrollments')
          .select('progress_percentage, enrolled_at, completed_steps')
          .eq('employee_id', id),
      ])

      const enrollments = enrollRes.data ?? []
      const submissions = submissionRes.data ?? []
      const paths = pathRes.data ?? []

      const gradeLevels = enrollments
        .map(e => (e.courses as unknown as { grade_level?: string })?.grade_level)
        .filter(Boolean) as string[]
      const subjectsFromCourses = enrollments
        .map(e => (e.courses as unknown as { subject?: string })?.subject)
        .filter(Boolean) as string[]
      const grade = gradeLevels[0] ?? ''
      const primarySubject = subjectsFromCourses[0] ?? ''
      setYearSubject([grade, primarySubject].filter(Boolean).join(' · '))

      const learnAvg = enrollments.length > 0
        ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage ?? 0), 0) / enrollments.length)
        : null
      const assessAvg = submissions.length > 0
        ? Math.round(submissions.reduce((s, e) => s + (e.percentage ?? 0), 0) / submissions.length)
        : null
      const trainAvg = paths.length > 0
        ? Math.round(paths.reduce((s, p) => s + (p.progress_percentage ?? 0), 0) / paths.length)
        : null

      const avgs = [learnAvg, assessAvg, trainAvg].filter((v): v is number => v != null)
      setOverallAvg(avgs.length > 0 ? `${Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length)}%` : '-')

      const activityDates: string[] = []
      enrollments.forEach(e => { if (e.enrolled_at) activityDates.push(e.enrolled_at) })
      submissions.forEach(s => { if (s.submitted_at) activityDates.push(s.submitted_at) })
      paths.forEach(p => { if (p.enrolled_at) activityDates.push(p.enrolled_at) })

      if (activityDates.length > 0) {
        const weekKeys = new Set<string>()
        activityDates.forEach(d => {
          const dt = new Date(d)
          const weekStart = new Date(dt)
          weekStart.setDate(dt.getDate() - dt.getDay())
          weekKeys.add(weekStart.toISOString().slice(0, 10))
        })
        const first = new Date(Math.min(...activityDates.map(d => new Date(d).getTime())))
        const weeksSince = Math.max(1, Math.ceil((Date.now() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)))
        const windowWeeks = Math.min(12, weeksSince)
        setAttendanceProxy(`${Math.round((weekKeys.size / windowWeeks) * 100)}%`)
      }

      const assignmentCount = enrollments.reduce((s, e) => s + ((e.completed_modules as string[] | null)?.length ?? 0), 0)
      setAssignments(String(assignmentCount))

      if (paths.length > 0) {
        const done = paths.filter(p => (p.progress_percentage ?? 0) >= 100).length
        setTrainProgress(`${done}/${paths.length}`)
      }

      setScorePoints(
        submissions
          .filter(s => s.submitted_at)
          .map(s => ({ date: s.submitted_at as string, score: Math.round(s.percentage ?? 0) }))
      )

      const subjectMap: Record<string, number[]> = {}
      enrollments.forEach(e => {
        const sub = (e.courses as unknown as { subject?: string })?.subject ?? 'General'
        if (!subjectMap[sub]) subjectMap[sub] = []
        subjectMap[sub].push(e.progress_percentage ?? 0)
      })
      submissions.forEach(s => {
        const examSub = (s.exam_sessions as unknown as { exams?: { subject?: string } })?.exams?.subject ?? 'Assessments'
        if (!subjectMap[examSub]) subjectMap[examSub] = []
        subjectMap[examSub].push(Math.round(s.percentage ?? 0))
      })

      setSubjects(
        Object.entries(subjectMap)
          .map(([subject, vals]) => ({
            subject,
            pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          }))
          .sort((a, b) => b.pct - a.pct)
      )

      const { data: quizzes } = await supabase.from('quizzes').select('id').eq('institution_id', iid)
      const quizIds = (quizzes ?? []).map(q => q.id)
      if (quizIds.length > 0) {
        const { data: sessions } = await supabase
          .from('engage_sessions')
          .select('id')
          .in('quiz_id', quizIds)
          .eq('status', 'ended')
        const sessionIds = (sessions ?? []).map(s => s.id)

        if (sessionIds.length > 0) {
          const [{ data: myParts }, { data: allParts }] = await Promise.all([
            supabase
              .from('session_participants')
              .select('session_id, score, rank')
              .in('session_id', sessionIds)
              .ilike('display_name', student.name),
            supabase
              .from('session_participants')
              .select('session_id, display_name, score, rank')
              .in('session_id', sessionIds),
          ])

          if (myParts && myParts.length > 0) {
            const rankedParts = myParts.filter(p => p.rank != null)
            if (rankedParts.length > 0) {
              setEngageRank(ordinal(Math.min(...rankedParts.map(p => p.rank as number))))
            } else if (allParts) {
              const bySession: Record<string, typeof allParts> = {}
              allParts.forEach(p => {
                if (!bySession[p.session_id]) bySession[p.session_id] = []
                bySession[p.session_id].push(p)
              })
              const ranks: number[] = []
              for (const part of myParts) {
                const sessionParts = (bySession[part.session_id] ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                const idx = sessionParts.findIndex(p => p.display_name.toLowerCase() === student.name.toLowerCase())
                if (idx >= 0) ranks.push(idx + 1)
              }
              if (ranks.length > 0) setEngageRank(ordinal(Math.min(...ranks)))
            }
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Student analytics" />
        <div style={{ padding: '22px 24px', color: 'var(--mid-grey)', fontSize: 14 }}>
          Pulling this student&apos;s records...
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar
          mode="platform"
          title="Student not found"
          right={<Link href="/platform/analytics" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>Back to analytics</Link>}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Student analytics"
        right={
          <Link href="/platform/analytics" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            Back to analytics
          </Link>
        }
      />

      <div style={{ padding: '22px 24px', maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--violet-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--violet)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.2 }}>{name}</h1>
              {yearSubject && (
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 4 }}>{yearSubject}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {email && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { window.location.href = `mailto:${email}` }}
              >
                Message
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={exportReport}>
              Export report
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Overall avg', value: overallAvg },
            { label: 'Attendance proxy', value: attendanceProxy },
            { label: 'Assignments', value: assignments },
            { label: 'Engage rank', value: engageRank },
            { label: 'Train progress', value: trainProgress },
          ].map(kpi => (
            <div
              key={kpi.label}
              style={{
                flex: '1 1 120px',
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                borderRadius: 10,
                padding: '16px 18px',
                minWidth: 110,
              }}
            >
              <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{kpi.value}</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 6 }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 22px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>
              Exam scores over time
            </p>
            <ScoreSparkline points={scorePoints} />
          </div>

          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 22px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>
              Subject breakdown
            </p>
            {subjects.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No subject data yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {subjects.map(s => {
                  const color = s.pct >= 75 ? 'var(--teal)' : s.pct >= 50 ? 'var(--amber)' : 'var(--coral)'
                  return (
                    <div key={s.subject}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--near-black)' }}>{s.subject}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color }}>{s.pct}%</span>
                      </div>
                      <ProgressTrack value={s.pct} color={color} height={8} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
