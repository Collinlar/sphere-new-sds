'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchStudentBadges } from '@/lib/student-badges'
import { IconCheck, IconDocument, IconPlay } from '@/components/icons'

interface ActivityItem {
  id: string
  kind: 'complete' | 'submit' | 'game'
  title: string
  subtitle: string
  date: string
}

function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const styles = {
    complete: { bg: '#DDFAF0', color: '#1A8966' },
    submit: { bg: '#E3EDFB', color: '#1052A3' },
    game: { bg: '#0C1021', color: 'rgba(255,255,255,0.7)' },
  }[kind]

  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      background: styles.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: styles.color,
    }}>
      {kind === 'complete' && <IconCheck size={13} />}
      {kind === 'submit' && <IconDocument size={13} />}
      {kind === 'game' && <IconPlay size={13} />}
    </div>
  )
}

export default function StudentProfilePage() {
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [gradeLevel, setGradeLevel] = useState('')
  const [courseCount, setCourseCount] = useState(0)
  const [avgScore, setAvgScore] = useState<number | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      setName(user.name)
      setInitials(user.avatar_initials || user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase())

      const [enrollRes, submissionRes, badges] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id, enrolled_at, progress_percentage, courses(title, subject, grade_level)')
          .eq('student_id', user.id)
          .order('enrolled_at', { ascending: false }),
        supabase
          .from('exam_submissions')
          .select('id, percentage, submitted_at, exam_sessions(exams(title))')
          .eq('student_id', user.id)
          .not('percentage', 'is', null)
          .order('submitted_at', { ascending: false }),
        fetchStudentBadges(user.id),
      ])

      const enrollments = enrollRes.data ?? []
      const submissions = submissionRes.data ?? []

      setCourseCount(enrollments.length)
      setBadgeCount(badges.filter(b => b.earned).length)

      const courseSubjects = Array.from(new Set(
        enrollments.map(e => (e.courses as unknown as { subject?: string })?.subject).filter(Boolean)
      )) as string[]
      setSubjects(courseSubjects.slice(0, 2))
      const firstGrade = (enrollments[0]?.courses as unknown as { grade_level?: string })?.grade_level
      setGradeLevel(firstGrade ?? '')

      if (submissions.length > 0) {
        const avg = submissions.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / submissions.length
        setAvgScore(Math.round(avg))
      }

      const items: ActivityItem[] = []

      enrollments.filter(e => (e.progress_percentage ?? 0) >= 100).slice(0, 2).forEach(e => {
        const course = e.courses as unknown as { title?: string }
        items.push({
          id: e.id,
          kind: 'complete',
          title: `Completed ${course?.title ?? 'course'}`,
          subtitle: '100%',
          date: e.enrolled_at,
        })
      })

      submissions.slice(0, 2).forEach(s => {
        items.push({
          id: s.id,
          kind: 'submit',
          title: `Submitted ${(s.exam_sessions as unknown as { exams?: { title?: string } })?.exams?.title ?? 'exam'}`,
          subtitle: s.percentage != null ? `${Math.round(s.percentage)}%` : 'Graded',
          date: s.submitted_at ?? '',
        })
      })

      setActivity(items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5))
      setLoading(false)
    }
    load()
  }, [])

  function relativeTime(dateStr: string) {
    if (!dateStr) return ''
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diffMs / 3600000)
    if (hours < 1) return 'Today'
    if (hours < 24) return 'Today'
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your profile...</div>
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, #1a2240 100%)',
        padding: '32px 24px 28px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: 26,
          fontWeight: 700,
          color: '#fff',
        }}>
          {initials}
        </div>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{name}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          {[gradeLevel, ...subjects].filter(Boolean).join(' · ') || 'Student'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{courseCount}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Courses</p>
          </div>
          <div style={{ width: 0.5, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>{avgScore !== null ? `${avgScore}%` : '—'}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Avg score</p>
          </div>
          <div style={{ width: 0.5, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{badgeCount}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Badges</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 22px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Recent activity
        </p>
        {activity.length === 0 ? (
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '24px 16px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14, marginBottom: 18 }}>
            No activity yet. Join a course or exam to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {activity.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--white)', borderRadius: 10, boxShadow: 'var(--shadow-soft)' }}>
                <ActivityIcon kind={item.kind} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{item.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{relativeTime(item.date)}{item.subtitle ? ` · ${item.subtitle}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/student/settings" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ height: 40, background: 'var(--bg2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>
              Edit profile
            </div>
          </Link>
          <Link href="/student/settings" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ height: 40, background: 'var(--bg2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>
              Settings
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
