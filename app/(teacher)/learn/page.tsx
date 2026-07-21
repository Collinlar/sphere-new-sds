'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Course } from '@/lib/types'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { fetchCourseEnrollmentStats } from '@/lib/course-stats'


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

type ResourceTab = 'courses' | 'guides' | 'notes' | 'documents'

interface SimpleResource {
  id: string
  title: string
  subject: string | null
  cover_color?: string
  is_published: boolean
  created_at: string
  marketplace_listing_id?: string | null
}

const RESOURCE_TABS: { key: ResourceTab; label: string; createHref: string; createLabel: string }[] = [
  { key: 'courses', label: 'Courses', createHref: '/learn/builder', createLabel: '+ Create course' },
  { key: 'guides', label: 'Guides', createHref: '/learn/guide/builder', createLabel: '+ Create guide' },
  { key: 'notes', label: 'Notes', createHref: '/learn/notes/builder', createLabel: '+ Create note' },
  { key: 'documents', label: 'Documents', createHref: '/learn/documents/builder', createLabel: '+ Add document' },
]

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [guides, setGuides] = useState<SimpleResource[]>([])
  const [notes, setNotes] = useState<SimpleResource[]>([])
  const [documents, setDocuments] = useState<SimpleResource[]>([])
  const [tab, setTab] = useState<ResourceTab>('courses')
  const [loading, setLoading] = useState(true)
  const [totalEnrolled, setTotalEnrolled] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [courseStats, setCourseStats] = useState<Record<string, { enrolled: number; avgCompletion: number }>>({})

  useEffect(() => {
    async function fetchAll() {
      const user = getCurrentUser()
      const filter = user.institution_id
        ? `creator_id.eq.${user.id},institution_id.eq.${user.institution_id}`
        : `creator_id.eq.${user.id}`

      const [coursesRes, guidesRes, notesRes, docsRes] = await Promise.all([
        supabase.from('courses').select('*').or(filter).order('created_at', { ascending: false }),
        supabase.from('guides').select('id, title, subject, cover_color, is_published, created_at, marketplace_listing_id').or(filter).order('created_at', { ascending: false }),
        supabase.from('notes').select('id, title, subject, cover_color, is_published, created_at, marketplace_listing_id').or(filter).order('created_at', { ascending: false }),
        supabase.from('documents').select('id, title, subject, cover_color, is_published, created_at, marketplace_listing_id').or(filter).order('created_at', { ascending: false }),
      ])

      const courseList = (coursesRes.data ?? []) as Course[]
      setCourses(courseList)
      setGuides((guidesRes.data ?? []) as SimpleResource[])
      setNotes((notesRes.data ?? []) as SimpleResource[])
      setDocuments((docsRes.data ?? []) as SimpleResource[])

      const stats = await fetchCourseEnrollmentStats(courseList.map((c) => c.id))
      setTotalEnrolled(stats.totalEnrolled)
      setAvgCompletion(stats.avgCompletion)
      setCourseStats(stats.byCourse)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const published = courses.filter(c => c.is_published).length

  const activeTab = RESOURCE_TABS.find(t => t.key === tab)!
  const tabData: Record<ResourceTab, SimpleResource[] | Course[]> = { courses, guides, notes, documents }
  const counts: Record<ResourceTab, number> = {
    courses: courses.length, guides: guides.length, notes: notes.length, documents: documents.length,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title="Learn"
        right={
          <Link href={activeTab.createHref}>
            <Button accent="#1A8966" size="sm">{activeTab.createLabel}</Button>
          </Link>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {/* Resource type tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {RESOURCE_TABS.map(t => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
                  background: isActive ? '#1A8966' : 'var(--white)',
                  boxShadow: isActive ? 'none' : 'var(--shadow-soft)',
                  color: isActive ? '#fff' : 'var(--mid-grey)',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg2)',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                }}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14, padding: '40px 0' }}>
            Loading your resources...
          </div>
        ) : tab !== 'courses' ? (
          <ResourceList
            items={tabData[tab] as SimpleResource[]}
            viewType={tab === 'documents' ? 'document' : tab === 'notes' ? 'notes' : 'guide'}
            typeLabel={activeTab.label.toLowerCase()}
            createHref={activeTab.createHref}
            createLabel={activeTab.createLabel.replace('+ ', '')}
          />
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
                    enrolled={courseStats[course.id]?.enrolled ?? 0}
                    completion={courseStats[course.id]?.avgCompletion ?? 0}
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

function ResourceList({ items, viewType, typeLabel, createHref, createLabel }: {
  items: SimpleResource[]
  viewType: 'guide' | 'notes' | 'document'
  typeLabel: string
  createHref: string
  createLabel: string
}) {
  if (items.length === 0) {
    return (
      <div style={{
        background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
        borderRadius: 10, padding: 48, textAlign: 'center',
      }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--near-black)', marginBottom: 8 }}>
          No {typeLabel} yet
        </div>
        <div style={{ color: 'var(--mid-grey)', fontSize: 14, marginBottom: 20 }}>
          Build your first one and share it with your learners.
        </div>
        <Link href={createHref}>
          <Button accent="#1A8966">{createLabel}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {items.map(item => (
        <Link key={item.id} href={`/learn/view/${viewType}/${item.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
            borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
          }}>
            <div style={{ height: 6, background: item.cover_color ?? '#1A8966' }} />
            <div style={{ padding: '14px 18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{item.title}</p>
                <span style={{
                  fontSize: 11, fontWeight: 500, flexShrink: 0,
                  color: item.is_published ? '#1A8966' : '#6B6870',
                  background: item.is_published ? '#DDFAF0' : '#EDECE9',
                  padding: '2px 8px', borderRadius: 4,
                }}>
                  {item.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                {item.subject ?? 'No subject'} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
              {item.marketplace_listing_id && (
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#1A8966', marginTop: 6 }}>
                  On marketplace
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
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
