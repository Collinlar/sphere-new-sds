'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchStudentBadges } from '@/lib/student-badges'
import SegmentTabs from '@/components/ui/SegmentTabs'
import ProgressTrack from '@/components/ui/ProgressTrack'

interface SubjectPerf {
  subject: string
  pct: number
}

export default function StudentProgressPage() {
  const [period, setPeriod] = useState('term')
  const [learnAvg, setLearnAvg] = useState<number | null>(null)
  const [assessAvg, setAssessAvg] = useState<number | null>(null)
  const [trainDone, setTrainDone] = useState<string>('—')
  const [engageRank, setEngageRank] = useState<string>('—')
  const [subjects, setSubjects] = useState<SubjectPerf[]>([])
  const [badges, setBadges] = useState<Awaited<ReturnType<typeof fetchStudentBadges>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      const termStart = new Date()
      termStart.setMonth(termStart.getMonth() - 4)

      const [enrollRes, submissionRes, pathRes, badgeList] = await Promise.all([
        supabase.from('enrollments').select('progress_percentage, enrolled_at, courses(subject)').eq('student_id', user.id),
        supabase.from('exam_submissions').select('percentage, submitted_at').eq('student_id', user.id).not('percentage', 'is', null),
        supabase.from('path_enrollments').select('progress_percentage, completed_steps').eq('employee_id', user.id),
        fetchStudentBadges(user.id),
      ])

      const filterByPeriod = <T extends { enrolled_at?: string; submitted_at?: string }>(rows: T[], dateKey: keyof T) => {
        if (period === 'all') return rows
        return rows.filter(r => {
          const d = r[dateKey] as string | undefined
          return d && new Date(d) >= termStart
        })
      }

      const enrollments = enrollRes.data ?? []
      const submissions = (submissionRes.data ?? []).filter(s => {
        if (period === 'all') return true
        return s.submitted_at && new Date(s.submitted_at) >= termStart
      })

      if (enrollments.length > 0) {
        setLearnAvg(Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage ?? 0), 0) / enrollments.length))
      }

      if (submissions.length > 0) {
        setAssessAvg(Math.round(submissions.reduce((s, e) => s + (e.percentage ?? 0), 0) / submissions.length))
      }

      const paths = pathRes.data ?? []
      if (paths.length > 0) {
        const done = paths.filter(p => (p.progress_percentage ?? 0) >= 100).length
        setTrainDone(`${done}/${paths.length}`)
      }

      setEngageRank('4th')

      const subjectMap: Record<string, number[]> = {}
      enrollments.forEach(e => {
        const sub = (e.courses as unknown as { subject?: string })?.subject
        if (sub) {
          if (!subjectMap[sub]) subjectMap[sub] = []
          subjectMap[sub].push(e.progress_percentage ?? 0)
        }
      })
      submissions.forEach(s => {
        const sub = 'Assessments'
        if (!subjectMap[sub]) subjectMap[sub] = []
        subjectMap[sub].push(s.percentage ?? 0)
      })

      setSubjects(Object.entries(subjectMap).map(([subject, vals]) => ({
        subject,
        pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      })).slice(0, 6))

      setBadges(badgeList)
      setLoading(false)
    }
    load()
  }, [period])

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your progress...</div>
  }

  return (
    <div>
      <div style={{ height: 52, background: 'var(--white)', borderBottom: '0.5px solid var(--bg2)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>My progress</span>
        <SegmentTabs
          tabs={[{ key: 'term', label: 'This term' }, { key: 'all', label: 'All time' }]}
          active={period}
          onChange={setPeriod}
        />
      </div>

      <div style={{ padding: '16px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Learn avg', value: learnAvg != null ? `${learnAvg}%` : '—', color: 'var(--teal)' },
            { label: 'Assess avg', value: assessAvg != null ? `${assessAvg}%` : '—', color: 'var(--amber)' },
            { label: 'Train done', value: trainDone, color: 'var(--violet)' },
            { label: 'Best Engage', value: engageRank, color: 'var(--navy)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--white)', borderRadius: 10, padding: 14, boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--white)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow-soft)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14 }}>
            Course performance
          </p>
          {subjects.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No course data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {subjects.map(s => (
                <div key={s.subject}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--near-black)' }}>{s.subject}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.pct >= 75 ? 'var(--teal)' : 'var(--amber)' }}>{s.pct}%</span>
                  </div>
                  <ProgressTrack value={s.pct} color={s.pct >= 75 ? 'var(--teal)' : 'var(--amber)'} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--white)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Badges earned
            </p>
            <Link href="/student/achievements" style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', textDecoration: 'none' }}>
              See all
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {badges.map(b => (
              <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: b.earned ? 1 : 0.4 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: b.earned ? b.bg : 'var(--bg2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: b.earned ? b.color : 'var(--text-tertiary)',
                }}>
                  {b.icon}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
