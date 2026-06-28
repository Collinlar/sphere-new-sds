'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface CoursePerf {
  id: string
  title: string
  studentCount: number
  avgProgress: number
  isPublished: boolean
}

interface Performer {
  id: string
  name: string
  initials: string
  avgPct: number
  courseCount: number
}

const CONTENT_TYPE_META: Record<string, { label: string; color: string }> = {
  video: { label: 'Video', color: '#1A8966' },
  reading: { label: 'Reading', color: '#1052A3' },
  quiz: { label: 'Quiz', color: '#C23B2A' },
  assignment: { label: 'Assignment', color: '#D97010' },
  flashcards: { label: 'Flashcards', color: '#2E2886' },
}

export default function PlatformAnalyticsPage() {
  const [institutionName, setInstitutionName] = useState('')
  const [loading, setLoading] = useState(true)

  const [totalStudents, setTotalStudents] = useState(0)
  const [activeThisWeek, setActiveThisWeek] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [examsTaken, setExamsTaken] = useState(0)
  const [avgExamScore, setAvgExamScore] = useState(0)
  const [gamesPlayed, setGamesPlayed] = useState(0)

  const [coursePerf, setCoursePerf] = useState<CoursePerf[]>([])
  const [contentTypes, setContentTypes] = useState<{ type: string; count: number; pct: number }[]>([])
  const [topPerformers, setTopPerformers] = useState<Performer[]>([])

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      const iid = user.institution_id
      if (!iid) { setLoading(false); return }

      const [instRes, studentsRes, coursesRes, examsRes, quizzesRes] = await Promise.all([
        supabase.from('institutions').select('name').eq('id', iid).single(),
        supabase.from('users').select('id').eq('institution_id', iid).eq('role', 'student'),
        supabase.from('courses').select('id, title, modules, is_published').eq('institution_id', iid),
        supabase.from('exams').select('id').eq('institution_id', iid),
        supabase.from('quizzes').select('id').eq('institution_id', iid),
      ])

      if (instRes.data) setInstitutionName(instRes.data.name ?? '')

      const studentIds = (studentsRes.data ?? []).map(s => s.id)
      setTotalStudents(studentIds.length)

      const courses = coursesRes.data ?? []
      const courseIds = courses.map(c => c.id)

      const examIds = (examsRes.data ?? []).map(e => e.id)
      const quizIds = (quizzesRes.data ?? []).map(q => q.id)

      const [enrollRes, sessionsRes] = await Promise.all([
        courseIds.length > 0
          ? supabase.from('enrollments').select('student_id, progress_percentage, enrolled_at, course_id').in('course_id', courseIds)
          : Promise.resolve({ data: [] as { student_id: string; progress_percentage: number; enrolled_at: string; course_id: string }[] }),
        examIds.length > 0
          ? supabase.from('exam_sessions').select('id').in('exam_id', examIds)
          : Promise.resolve({ data: [] as { id: string }[] }),
      ])

      const enrollments = enrollRes.data ?? []
      const examSessionIds = (sessionsRes.data ?? []).map(s => s.id)

      const [submissionsRes, gamesRes] = await Promise.all([
        examSessionIds.length > 0
          ? supabase.from('exam_submissions').select('student_id, percentage, submitted_at').in('exam_session_id', examSessionIds).not('percentage', 'is', null)
          : Promise.resolve({ data: [] as { student_id: string | null; percentage: number; submitted_at: string }[] }),
        quizIds.length > 0
          ? supabase.from('engage_sessions').select('id', { count: 'exact' }).in('quiz_id', quizIds).eq('status', 'ended')
          : Promise.resolve({ count: 0 }),
      ])

      const submissions = submissionsRes.data ?? []
      setExamsTaken(submissions.length)
      setAvgExamScore(submissions.length > 0 ? Math.round(submissions.reduce((s, x) => s + (x.percentage ?? 0), 0) / submissions.length) : 0)
      setGamesPlayed(gamesRes.count ?? 0)

      setAvgCompletion(enrollments.length > 0 ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage ?? 0), 0) / enrollments.length) : 0)

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const activeIds = new Set<string>()
      enrollments.forEach(e => { if (e.enrolled_at && new Date(e.enrolled_at).getTime() > weekAgo && e.student_id) activeIds.add(e.student_id) })
      submissions.forEach(s => { if (s.submitted_at && new Date(s.submitted_at).getTime() > weekAgo && s.student_id) activeIds.add(s.student_id) })
      setActiveThisWeek(activeIds.size)

      const courseStats: CoursePerf[] = courses.map(c => {
        const rows = enrollments.filter(e => e.course_id === c.id)
        return {
          id: c.id,
          title: c.title,
          studentCount: rows.length,
          avgProgress: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.progress_percentage ?? 0), 0) / rows.length) : 0,
          isPublished: c.is_published,
        }
      }).sort((a, b) => b.studentCount - a.studentCount).slice(0, 5)
      setCoursePerf(courseStats)

      const typeCounts: Record<string, number> = {}
      courses.forEach(c => {
        (c.modules ?? []).forEach((m: { type: string }) => {
          typeCounts[m.type] = (typeCounts[m.type] ?? 0) + 1
        })
      })
      const totalModules = Object.values(typeCounts).reduce((s, v) => s + v, 0)
      setContentTypes(
        Object.entries(typeCounts)
          .map(([type, count]) => ({ type, count, pct: totalModules > 0 ? Math.round((count / totalModules) * 100) : 0 }))
          .sort((a, b) => b.count - a.count)
      )

      const byStudent: Record<string, { total: number; count: number; courses: Set<string> }> = {}
      submissions.forEach(s => {
        if (!s.student_id) return
        if (!byStudent[s.student_id]) byStudent[s.student_id] = { total: 0, count: 0, courses: new Set() }
        byStudent[s.student_id].total += s.percentage ?? 0
        byStudent[s.student_id].count += 1
      })
      enrollments.forEach(e => {
        if (!e.student_id) return
        if (!byStudent[e.student_id]) byStudent[e.student_id] = { total: 0, count: 0, courses: new Set() }
        byStudent[e.student_id].courses.add(e.course_id)
      })
      const ranked = Object.entries(byStudent)
        .filter(([, v]) => v.count > 0)
        .map(([id, v]) => ({ id, avgPct: Math.round(v.total / v.count), courseCount: v.courses.size }))
        .sort((a, b) => b.avgPct - a.avgPct)
        .slice(0, 5)

      if (ranked.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, avatar_initials').in('id', ranked.map(r => r.id))
        const userMap = new Map((usersData ?? []).map(u => [u.id, u]))
        setTopPerformers(ranked.map(r => ({
          id: r.id,
          name: userMap.get(r.id)?.name ?? 'Student',
          initials: userMap.get(r.id)?.avatar_initials ?? '??',
          avgPct: r.avgPct,
          courseCount: r.courseCount,
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const PERFORMER_COLORS = ['#1A8966', '#1052A3', '#2E2886', '#9A5800', '#6B6870']
  const PERFORMER_BG = ['#DDFAF0', '#E3EDFB', '#EEEDF8', '#FEF0DC', '#EDECE9']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Analytics" />

      <div style={{ padding: '22px 24px', maxWidth: 1260 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Crunching your institution's numbers...</div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 20 }}>{institutionName}</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', flex: 1 }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{totalStudents}</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 6 }}>Total students</p>
              </div>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', flex: 1 }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{activeThisWeek}</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 6 }}>Active this week</p>
              </div>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', flex: 1 }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{avgCompletion}%</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 6 }}>Avg completion</p>
                <div style={{ marginTop: 10, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${avgCompletion}%`, height: '100%', background: 'var(--teal)', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', flex: 1 }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{examsTaken}</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 6 }}>Exams taken</p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Avg score {avgExamScore}%</p>
              </div>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', flex: 1 }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1 }}>{gamesPlayed}</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 6 }}>Games played</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', marginTop: 4 }}>Engage module</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 22px', flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 20 }}>Course completion</p>
                {coursePerf.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No courses yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {coursePerf.map(c => {
                      const color = c.avgProgress >= 60 ? '#1A8966' : c.avgProgress >= 35 ? '#D97010' : '#C23B2A'
                      return (
                        <div key={c.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                            <span style={{ fontSize: 13, color: 'var(--near-black)' }}>{c.title}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color }}>{c.avgProgress}%</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${c.avgProgress}%`, height: '100%', background: color, borderRadius: 4 }} />
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {c.studentCount} student{c.studentCount === 1 ? '' : 's'}{!c.isPublished ? ' — Draft' : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 22px', width: 220, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 18 }}>Content type</p>
                {contentTypes.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No modules yet.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
                      {contentTypes.map(ct => (
                        <div key={ct.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: CONTENT_TYPE_META[ct.type]?.color ?? '#6B6870', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--near-black)', flex: 1 }}>{CONTENT_TYPE_META[ct.type]?.label ?? ct.type}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{ct.pct}%</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                      {contentTypes.map(ct => (
                        <div key={ct.type} style={{ width: `${ct.pct}%`, background: CONTENT_TYPE_META[ct.type]?.color ?? '#6B6870' }} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px 22px', width: 300, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Top performers</p>
                {topPerformers.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No graded exams yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {topPerformers.map((p, i) => (
                      <Link
                        key={p.id}
                        href={`/platform/analytics/students/${p.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', borderRadius: 8, padding: '4px 2px', margin: '-4px -2px' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: PERFORMER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: PERFORMER_COLORS[i], flexShrink: 0 }}>
                          {p.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.courseCount} course{p.courseCount === 1 ? '' : 's'} · {p.avgPct}% avg</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: PERFORMER_COLORS[i] }}>{p.avgPct}%</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
