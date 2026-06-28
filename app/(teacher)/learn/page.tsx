'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Course } from '@/lib/types'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'


function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--white)',
      boxShadow: 'var(--shadow-soft)',
      borderRadius: 10,
      padding: '20px 24px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ModuleTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    video: '▶',
    reading: '📄',
    quiz: '✓',
    assignment: '📝',
    flashcards: '🃏',
  }
  return <span style={{ fontSize: 12 }}>{icons[type] ?? '•'}</span>
}

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('institution_id', getCurrentUser().institution_id)
      if (!error && data) {
        setCourses(data)
      }
      setLoading(false)
    }
    fetchCourses()
  }, [])

  const published = courses.filter(c => c.is_published).length
  const totalEnrolled = 0
  const avgCompletion = 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title="Courses"
        right={
          <Link href="/learn/builder">
            <Button accent="#1A8966" size="sm">+ Create course</Button>
          </Link>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14, padding: '40px 0' }}>
            Loading your courses...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
              <StatCard label="Courses created" value={courses.length} />
              <StatCard label="Students enrolled" value={totalEnrolled} />
              <StatCard label="Avg completion" value={`${avgCompletion}%`} />
              <StatCard label="Published" value={published} />
            </div>

            {courses.length === 0 ? (
              <div style={{
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                borderRadius: 10,
                padding: 48,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--near-black)', marginBottom: 8 }}>
                  No courses yet
                </div>
                <div style={{ color: 'var(--mid-grey)', fontSize: 14, marginBottom: 20 }}>
                  Build your first course and share it with your students.
                </div>
                <Link href="/learn/builder">
                  <Button accent="#1A8966">Build your first course</Button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {courses.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolled={0}
                    completion={0}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CourseCard({ course, enrolled, completion }: { course: Course; enrolled: number; completion: number }) {
  return (
    <div style={{
      background: 'var(--white)',
      boxShadow: 'var(--shadow-soft)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        background: course.thumbnail_color,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
          {course.title[0]}
        </span>
      </div>

      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: course.is_published ? '#1A8966' : '#6B6870',
            background: course.is_published ? '#DDFAF0' : '#EDECE9',
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {course.is_published ? 'Published' : 'Draft'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{course.grade_level}</span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
          {course.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 12 }}>
          {course.subject}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {course.modules.slice(0, 4).map(m => (
            <span key={m.id} style={{
              fontSize: 11,
              color: 'var(--mid-grey)',
              background: 'var(--bg2)',
              borderRadius: 4,
              padding: '2px 7px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <ModuleTypeIcon type={m.type} />
              {m.type}
            </span>
          ))}
          {course.modules.length > 4 && (
            <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>+{course.modules.length - 4} more</span>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 4 }}>
          {course.modules.length} modules · {enrolled} students
        </div>

        {enrolled > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mid-grey)', marginBottom: 4 }}>
              <span>Avg completion</span>
              <span>{completion}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
              <div style={{ width: `${completion}%`, height: '100%', background: '#1A8966', borderRadius: 2 }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/learn/builder?id=${course.id}`} style={{ flex: 1 }}>
            <Button variant="secondary" size="sm" full>Edit course</Button>
          </Link>
          <Link href={`/learn/class/${course.id}`} style={{ flex: 1 }}>
            <Button accent="#1A8966" size="sm" full>Manage class</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
