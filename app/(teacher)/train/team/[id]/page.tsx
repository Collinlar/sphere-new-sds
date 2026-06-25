'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'

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
  5: '#0F6E56',
  4: '#2BA888',
  3: '#EF9F27',
  2: '#E05C4B',
  1: '#C03A2A',
  0: '#EAE6DC',
}

const DEPARTMENTS = ['All', 'Sales', 'Operations', 'HR', 'Finance', 'Customer Support']

export default function TeamProgressPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [dept, setDept] = useState('All')
  const [tab, setTab] = useState<'progress' | 'skills'>('progress')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('path_enrollments')
        .select('*, users(*)')
        .eq('path_id', params.id)
      if (!error && data && data.length > 0) {
        setEmployees(data.map((e: { id: string; enrolled_at: string; completed_at: string | null; users: { id: string; name: string } | null }) => ({
          id: e.users?.id ?? e.id,
          name: e.users?.name ?? 'Unknown employee',
          department: '',
          enrolled_at: e.enrolled_at,
          progress: e.completed_at ? 100 : 0,
          steps_completed: 0,
          steps_total: 0,
          certificate: !!e.completed_at,
          skills: [0, 0, 0, 0, 0],
        })))
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const filtered = dept === 'All' ? employees : employees.filter(e => e.department === dept)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="train"
        title="Team progress"
        right={<Button variant="secondary" size="sm">Export report</Button>}
      />

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Fetching team progress...</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginRight: 12 }}>
                {(['progress', 'skills'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: tab === t ? 600 : 400,
                      color: tab === t ? '#185FA5' : 'var(--mid-grey)',
                      background: tab === t ? '#E6F1FB' : 'transparent',
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
                  onClick={() => setDept(d)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: dept === d ? 600 : 400,
                    color: dept === d ? '#0B2E52' : 'var(--mid-grey)',
                    background: dept === d ? '#E6F1FB' : 'var(--white)',
                    border: '0.5px solid var(--border)',
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
              <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--page-bg)', borderBottom: '0.5px solid var(--border)' }}>
                      {['Employee', 'Department', 'Enrolled', 'Progress', 'Steps', 'Certificate'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, idx) => (
                      <tr key={emp.id} style={{ borderBottom: idx < filtered.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', background: '#E6F1FB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 600, color: '#185FA5', flexShrink: 0,
                            }}>
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{emp.department}</td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                          {new Date(emp.enrolled_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 80, height: 5, background: 'var(--bg2)', borderRadius: 3 }}>
                              <div style={{
                                width: `${emp.progress}%`, height: '100%', borderRadius: 3,
                                background: emp.progress === 100 ? '#0F6E56' : emp.progress >= 50 ? '#185FA5' : '#EF9F27',
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
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', background: '#E1F5EE', padding: '3px 8px', borderRadius: 4 }}>Issued</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 4 }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'skills' && (
              <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', overflowX: 'auto' }}>
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
                              background: SKILL_COLORS[level] ?? '#EAE6DC',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              fontWeight: 700,
                              color: level >= 3 ? '#fff' : '#1A1A1A',
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
