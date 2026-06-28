'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface StudentCourse {
  id: string
  title: string
  subject: string
  thumbnail_color: string
  progress: number
  total_modules: number
  completed_count: number
  next_module: string
}

export default function StudentLearnDashboard() {
  const [courses, setCourses] = useState<StudentCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      setName(user?.name?.split(' ')[0] ?? '')

      const { data } = await supabase
        .from('enrollments')
        .select('id, progress_percentage, completed_modules, courses(id, title, subject, thumbnail_color, modules)')
        .eq('student_id', user.id)

      if (data) {
        setCourses(data.map((e) => {
          const course = e.courses as unknown as { id: string; title: string; subject: string; thumbnail_color: string; modules: { id: string; title: string }[] } | null
          const modules = course?.modules ?? []
          const completed: string[] = e.completed_modules ?? []
          const next = modules.find(m => !completed.includes(m.id))
          return {
            id: course?.id ?? e.id,
            title: course?.title ?? 'Untitled course',
            subject: course?.subject ?? '',
            thumbnail_color: course?.thumbnail_color ?? '#1A8966',
            progress: e.progress_percentage ?? 0,
            total_modules: modules.length,
            completed_count: completed.length,
            next_module: next?.title ?? '',
          }
        }))
      }
      setLoading(false)
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const inProgress = courses.filter(c => c.progress > 0 && c.progress < 100)
  const notStarted = courses.filter(c => c.progress === 0)
  const completed = courses.filter(c => c.progress >= 100)

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>
        Loading your courses...
      </div>
    )
  }

  function CourseRow({ course }: { course: StudentCourse }) {
    return (
      <Link href={`/student/learn/${course.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          background: 'var(--white)',
          boxShadow: 'var(--shadow-soft)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
        }}>
          <div style={{ width: 4, background: course.thumbnail_color, flexShrink: 0 }} />
          <div style={{ padding: '14px 14px 14px 12px', flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: course.thumbnail_color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>{course.title[0]?.toUpperCase()}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {course.title}
            </div>
            {course.progress > 0 && course.progress < 100 ? (
              <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 6 }}>
                Up next: {course.next_module || 'Continue where you left off'}
              </div>
            ) : course.progress >= 100 ? (
              <div style={{ fontSize: 12, color: '#1A8966', marginBottom: 6 }}>Completed</div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 6 }}>
                {course.total_modules} module{course.total_modules === 1 ? '' : 's'} · {course.subject}
              </div>
            )}
            {course.total_modules > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ width: `${course.progress}%`, height: '100%', background: course.thumbnail_color, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--mid-grey)', flexShrink: 0 }}>
                  {course.completed_count}/{course.total_modules}
                </span>
              </div>
            )}
          </div>
          <span style={{ color: 'var(--mid-grey)', fontSize: 18 }}>›</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 0', marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {greeting}{name ? `, ${name}` : ''}
        </div>
        <div style={{ fontSize: 14, color: 'var(--mid-grey)', marginTop: 4 }}>
          {courses.length === 0
            ? 'No courses yet'
            : `${inProgress.length} in progress · ${notStarted.length} not started`}
        </div>
        </div>
        <Link href="/student/profile" style={{ flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--teal)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '·'}
          </div>
        </Link>
      </div>

      {courses.length === 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
            Your teacher has not enrolled you in a course yet.
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, paddingLeft: 4 }}>
            In progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inProgress.map(course => <CourseRow key={course.id} course={course} />)}
          </div>
        </div>
      )}

      {notStarted.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, paddingLeft: 4 }}>
            Not started
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notStarted.map(course => <CourseRow key={course.id} course={course} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, paddingLeft: 4 }}>
            Completed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completed.map(course => <CourseRow key={course.id} course={course} />)}
          </div>
        </div>
      )}
    </div>
  )
}
