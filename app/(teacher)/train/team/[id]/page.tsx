'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import { getCurrentUser } from '@/lib/auth'
import { normalizeSteps, syncPathEnrollments, parseAssignedDepartments } from '@/lib/train-paths'

interface Employee {
  id: string
  name: string
  department: string
  enrolled_at: string
  progress: number
  steps_completed: number
  steps_total: number
  certificate: boolean
  skills: number[]
}

const SKILL_CATEGORIES = ['Communication', 'Data Privacy', 'Customer Service', 'Technical', 'Leadership']

const SKILL_COLORS: Record<number, string> = {
  5: '#1A8966',
  4: '#1A8966',
  3: '#D97010',
  2: '#C23B2A',
  1: '#C23B2A',
  0: '#EDECE9',
}

const DEPARTMENTS = ['All', 'Sales', 'Operations', 'HR', 'Finance', 'Customer Support', 'Engineering']

export default function TeamProgressPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pathTitle, setPathTitle] = useState('')
  const [stepsTotal, setStepsTotal] = useState(0)
  const [assignedDepartments, setAssignedDepartments] = useState<string[]>(['All staff'])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [dept, setDept] = useState('All')
  const [tab, setTab] = useState<'progress' | 'skills'>('progress')

  async function loadData() {
    setLoading(true)
    const [pathRes, enrollRes] = await Promise.all([
      supabase.from('learning_paths').select('*').eq('id', params.id).single(),
      supabase.from('path_enrollments').select('*, users(id, name, department)').eq('path_id', params.id),
    ])

    const path = pathRes.data
    let totalSteps = 0
    if (path) {
      setPathTitle(path.title)
      const steps = normalizeSteps(path.steps)
      totalSteps = steps.length
      setStepsTotal(totalSteps)
      setAssignedDepartments(parseAssignedDepartments(path))
    }

    const data = enrollRes.data
    if (data && data.length > 0) {
      setEmployees(data.map((e: {
        id: string
        enrolled_at: string
        progress_percentage: number | null
        completed_steps: string[] | null
        certificate_issued_at: string | null
        users: { id: string; name: string; department?: string } | null
      }) => {
        const completedSteps = Array.isArray(e.completed_steps) ? e.completed_steps : []
        const progress = e.progress_percentage ?? (totalSteps > 0 ? Math.round((completedSteps.length / totalSteps) * 100) : 0)
        return {
          id: e.users?.id ?? e.id,
          name: e.users?.name ?? 'Unknown employee',
          department: e.users?.department ?? 'Unassigned',
          enrolled_at: e.enrolled_at,
          progress,
          steps_completed: completedSteps.length,
          steps_total: totalSteps || completedSteps.length,
          certificate: !!e.certificate_issued_at || progress === 100,
          skills: [0, 0, 0, 0, 0],
        }
      }))
    } else {
      setEmployees([])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [params.id])

  useEffect(() => {
    if (stepsTotal > 0) {
      setEmployees(prev => prev.map(emp => ({
        ...emp,
        steps_total: stepsTotal,
        progress: stepsTotal > 0 ? Math.round((emp.steps_completed / stepsTotal) * 100) : emp.progress,
      })))
    }
  }, [stepsTotal])

  async function handleAssignTeam() {
    setAssigning(true)
    await syncPathEnrollments(params.id, getCurrentUser().institution_id, assignedDepartments)
    setAssigning(false)
    await loadData()
  }

  const filtered = dept === 'All' ? employees : employees.filter(e => e.department === dept)
  const completedCount = employees.filter(e => e.progress === 100).length
  const inProgressCount = employees.filter(e => e.progress > 0 && e.progress < 100).length
  const notStartedCount = employees.filter(e => e.progress === 0).length
  const avgCompletion = employees.length > 0 ? Math.round(employees.reduce((s, e) => s + e.progress, 0) / employees.length) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="train"
        title="Team progress"
        right={<Button variant="secondary" size="sm">Export report</Button>}
      />

      {!loading && employees.length > 0 && (
        <div style={{ background: 'var(--blue)', padding: '20px 32px' }}>
          {pathTitle && <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>{pathTitle} · {employees.length} enrolled</p>}
          <div style={{ display: 'flex', gap: 10, maxWidth: 520 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{completedCount}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Completed</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{inProgressCount}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>In progress</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{notStartedCount}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Not started</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{avgCompletion}%</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Avg completion</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Fetching team progress...</div>
        ) : employees.length === 0 ? (
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>No one assigned yet</p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
              {pathTitle ? `"${pathTitle}"` : 'This path'} has {stepsTotal} steps but no enrolled employees.
              Assign your team to start tracking progress here.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button accent="#1052A3" size="sm" onClick={handleAssignTeam} disabled={assigning}>
                {assigning ? 'Assigning team...' : 'Assign team now'}
              </Button>
              <Link href={`/train/builder?id=${params.id}`}>
                <Button variant="secondary" size="sm">Edit path</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, overflow: 'hidden', marginRight: 12 }}>
                {(['progress', 'skills'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: tab === t ? 600 : 400,
                      color: tab === t ? '#1052A3' : 'var(--mid-grey)',
                      background: tab === t ? '#E3EDFB' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t === 'progress' ? 'Progress' : 'Skill matrix'}
                  </button>
                ))}
              </div>
              {DEPARTMENTS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDept(d)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: dept === d ? 600 : 400,
                    color: dept === d ? '#1052A3' : 'var(--mid-grey)',
                    background: dept === d ? '#E3EDFB' : 'var(--white)',
                    boxShadow: 'var(--shadow-soft)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            {tab === 'progress' && (
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                      {['Employee', 'Department', 'Enrolled', 'Progress', 'Steps', 'Certificate'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                          No employees in this department filter.
                        </td>
                      </tr>
                    ) : filtered.map((emp, idx) => (
                      <tr key={emp.id} style={{ borderBottom: idx < filtered.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', background: '#E3EDFB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 600, color: '#1052A3', flexShrink: 0,
                            }}>
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{emp.department || 'Unassigned'}</td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                          {new Date(emp.enrolled_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 80, height: 5, background: 'var(--bg2)', borderRadius: 3 }}>
                              <div style={{
                                width: `${emp.progress}%`, height: '100%', borderRadius: 3,
                                background: emp.progress === 100 ? '#1A8966' : emp.progress >= 50 ? '#1052A3' : '#D97010',
                              }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{emp.progress}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                          {emp.steps_completed}/{emp.steps_total}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {emp.certificate ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#1A8966', background: '#DDFAF0', padding: '3px 9px', borderRadius: 20 }}>Issued</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '3px 9px', borderRadius: 20 }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'skills' && (
              <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>Employee</th>
                      {SKILL_CATEGORIES.map(s => (
                        <th key={s} style={{ textAlign: 'center', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, idx) => (
                      <tr key={emp.id} style={{ borderBottom: idx < filtered.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{emp.name}</td>
                        {emp.skills.map((level, si) => (
                          <td key={si} style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: SKILL_COLORS[level] ?? '#EDECE9',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              fontWeight: 700,
                              color: level >= 3 ? '#fff' : '#18171A',
                            }}>
                              {level}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: '0.5px solid var(--border)' }}>
                  {Object.entries(SKILL_COLORS).sort((a, b) => Number(b[0]) - Number(a[0])).map(([level, color]) => (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
                      <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>Level {level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
