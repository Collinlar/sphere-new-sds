'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import { enrollRosterInCourse } from '@/lib/enrollments'
import type { Course } from '@/lib/types'

interface Student {
  enrollment_id: string
  student_id: string
  name: string
  enrolled_at: string
  progress_percentage: number
  completed_modules: string[]
}

type FilterKey = 'all' | 'low' | 'mid' | 'high'
type TabKey = 'roster' | 'gradebook'

function progressFilter(p: number, key: FilterKey) {
  if (key === 'low') return p < 25
  if (key === 'mid') return p >= 25 && p <= 75
  if (key === 'high') return p > 75
  return true
}

function progressColor(p: number) {
  return p > 75 ? '#1A8966' : p > 25 ? '#D97010' : '#C23B2A'
}

export default function ClassPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [students, setStudents] = useState<Student[]>([])
  const [moduleNames, setModuleNames] = useState<{ id: string; title: string }[]>([])
  const [courseTitle, setCourseTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [tab, setTab] = useState<TabKey>('roster')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollingRoster, setEnrollingRoster] = useState(false)
  const [enrollMessage, setEnrollMessage] = useState('')

  async function load() {
    const [courseRes, enrollRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', params.id).single(),
      supabase.from('enrollments').select('id, student_id, enrolled_at, progress_percentage, completed_modules, users(name)').eq('course_id', params.id),
    ])
    if (courseRes.data) {
      setCourse(courseRes.data as Course)
      setCourseTitle(courseRes.data.title)
      setModuleNames((courseRes.data.modules ?? []).map((m: { id: string; title: string }) => ({ id: m.id, title: m.title })))
    }
    if (enrollRes.data) {
      setStudents(enrollRes.data.map((e: { id: string; student_id: string; enrolled_at: string; progress_percentage: number; completed_modules: string[]; users: { name?: string } | { name?: string }[] | null }) => ({
        enrollment_id: e.id,
        student_id: e.student_id,
        name: (Array.isArray(e.users) ? e.users[0]?.name : e.users?.name) ?? 'Student',
        enrolled_at: e.enrolled_at,
        progress_percentage: e.progress_percentage ?? 0,
        completed_modules: e.completed_modules ?? [],
      })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  async function inviteStudent() {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviting(true); setInviteError('')
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: Math.random().toString(36).slice(2, 12),
    })
    if (signUpError) { setInviteError(signUpError.message); setInviting(false); return }
    const userId = authData.user?.id
    if (!userId) { setInviteError('Could not create account.'); setInviting(false); return }
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: 'student',
      institution_id: (await supabase.from('courses').select('institution_id').eq('id', params.id).single()).data?.institution_id,
      avatar_initials: inviteName.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      created_at: new Date().toISOString(),
    })
    if (userError) { setInviteError(userError.message); setInviting(false); return }
    await supabase.from('enrollments').insert({
      course_id: params.id,
      student_id: userId,
      progress_percentage: 0,
      completed_modules: [],
      enrolled_at: new Date().toISOString(),
    })
    setInviteEmail(''); setInviteName('')
    setShowInvite(false); setInviting(false)
    load()
  }

  async function handleEnrollRoster() {
    if (!course?.roster_id) return
    setEnrollingRoster(true)
    setEnrollMessage('')
    try {
      const result = await enrollRosterInCourse(course)
      setEnrollMessage(
        result.added > 0
          ? `Enrolled ${result.added} student${result.added === 1 ? '' : 's'}${result.alreadyEnrolled ? `, ${result.alreadyEnrolled} already enrolled` : ''}.`
          : result.total > 0
            ? 'Everyone on this roster is already enrolled.'
            : 'No active students found on this roster.'
      )
      load()
    } catch {
      setEnrollMessage('Could not enroll the roster right now. Try again in a moment.')
    }
    setEnrollingRoster(false)
  }

  const filtered = students.filter(s => progressFilter(s.progress_percentage, filter))

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All students' },
    { key: 'low', label: 'Below 25%' },
    { key: 'mid', label: '25% to 75%' },
    { key: 'high', label: 'Above 75%' },
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
    borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--near-black)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title={courseTitle ? `${courseTitle} — Class` : 'Class management'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {course?.roster_id && (
              <Button variant="secondary" size="sm" onClick={handleEnrollRoster} disabled={enrollingRoster}>
                {enrollingRoster ? 'Enrolling...' : 'Enroll roster'}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}>Invite student</Button>
          </div>
        }
      />

      {!loading && students.length > 0 && (
        <div style={{ background: 'var(--teal)', padding: '20px 32px' }}>
          <div style={{ display: 'flex', gap: 10, maxWidth: 420 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{students.length}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Enrolled</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{students.filter(s => s.progress_percentage > 0 && s.progress_percentage < 100).length}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Active</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{Math.round(students.reduce((s, x) => s + x.progress_percentage, 0) / students.length)}%</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Avg progress</p>
            </div>
          </div>
        </div>
      )}

      {enrollMessage && (
        <div style={{ background: '#EEEDF8', color: '#2E2886', fontSize: 13, padding: '10px 32px' }}>
          {enrollMessage}
        </div>
      )}

      {showInvite && (
        <div style={{ background: 'var(--white)', borderBottom: '0.5px solid var(--border)', padding: '16px 32px' }}>
          <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2 }}>Invite a student to this course</div>
            {inviteError && <div style={{ fontSize: 13, color: '#C23B2A' }}>{inviteError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Student name" style={{ ...inputStyle, flex: 1 }} />
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button accent="#1A8966" size="sm" onClick={inviteStudent} disabled={inviting}>{inviting ? 'Sending invite...' : 'Send invite'}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowInvite(false); setInviteError('') }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Loading your class roster...</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, overflow: 'hidden', marginRight: 12 }}>
                {(['roster', 'gradebook'] as TabKey[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1A8966' : 'var(--mid-grey)', background: tab === t ? '#DDFAF0' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {t}
                  </button>
                ))}
              </div>
              {tab === 'roster' && filterOptions.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: filter === f.key ? 600 : 400, color: filter === f.key ? '#1A8966' : 'var(--mid-grey)', background: filter === f.key ? '#DDFAF0' : 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f.label}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--mid-grey)' }}>{students.length} {students.length === 1 ? 'student' : 'students'}</span>
            </div>

            {tab === 'roster' && (
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden' }}>
                {students.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                    No students enrolled yet. Use "Invite student" to add someone to this course.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                        {['Student', 'Enrolled', 'Progress', 'Modules done'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, idx) => (
                        <tr key={s.enrollment_id} style={{ borderBottom: idx < filtered.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DDFAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#1A8966', flexShrink: 0 }}>
                                {s.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{s.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                            {new Date(s.enrolled_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 80, height: 5, background: 'var(--bg2)', borderRadius: 3, flexShrink: 0 }}>
                                <div style={{ width: `${s.progress_percentage}%`, height: '100%', background: progressColor(s.progress_percentage), borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: progressColor(s.progress_percentage) }}>
                                {s.progress_percentage >= 100 ? 'Complete' : s.progress_percentage < 25 ? 'Behind' : `${s.progress_percentage}%`}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                            {s.completed_modules.length} of {moduleNames.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {students.length > 0 && filtered.length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                    No students match this filter.
                  </div>
                )}
              </div>
            )}

            {tab === 'gradebook' && (
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'auto' }}>
                {students.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                    No students enrolled yet.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>Student</th>
                        {moduleNames.map(m => (
                          <th key={m.id} style={{ textAlign: 'center', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', maxWidth: 100 }}>{m.title}</th>
                        ))}
                        <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, idx) => {
                        const overall = moduleNames.length > 0
                          ? Math.round((s.completed_modules.length / moduleNames.length) * 100)
                          : 0
                        return (
                          <tr key={s.enrollment_id} style={{ borderBottom: idx < students.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{s.name}</td>
                            {moduleNames.map(m => {
                              const done = s.completed_modules.includes(m.id)
                              return (
                                <td key={m.id} style={{ padding: '12px 12px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 15, color: done ? '#1A8966' : '#EDECE9' }}>{done ? '✓' : '○'}</span>
                                </td>
                              )
                            })}
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: progressColor(overall) }}>{overall}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
