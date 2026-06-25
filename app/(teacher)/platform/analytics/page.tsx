'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export default function PlatformAnalyticsPage() {
  const [institutionName, setInstitutionName] = useState('')
  const [plan, setPlan] = useState('')
  const [moduleCount, setModuleCount] = useState(0)
  const [userCount, setUserCount] = useState(0)
  const [quizzes, setQuizzes] = useState(0)
  const [exams, setExams] = useState(0)
  const [courses, setCourses] = useState(0)
  const [paths, setPaths] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      const iid = user.institution_id
      if (!iid) { setLoading(false); return }

      const [instRes, usersRes, qRes, eRes, cRes, pRes] = await Promise.all([
        supabase.from('institutions').select('name, subscription_plan, modules').eq('id', iid).single(),
        supabase.from('users').select('id', { count: 'exact' }).eq('institution_id', iid),
        supabase.from('quizzes').select('id', { count: 'exact' }).eq('institution_id', iid),
        supabase.from('exams').select('id', { count: 'exact' }).eq('institution_id', iid),
        supabase.from('courses').select('id', { count: 'exact' }).eq('institution_id', iid),
        supabase.from('learning_paths').select('id', { count: 'exact' }).eq('institution_id', iid),
      ])

      if (instRes.data) {
        setInstitutionName(instRes.data.name ?? '')
        setPlan(instRes.data.subscription_plan ?? 'trial')
        const mods = instRes.data.modules ?? {}
        setModuleCount(Object.values(mods).filter(Boolean).length)
      }
      setUserCount(usersRes.count ?? 0)
      setQuizzes(qRes.count ?? 0)
      setExams(eRes.count ?? 0)
      setCourses(cRes.count ?? 0)
      setPaths(pRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  const moduleStats = [
    { mode: 'Engage', color: '#EF9F27', bg: '#FEF3DC', value: quizzes, label: 'quizzes created' },
    { mode: 'Assess', color: '#E05C4B', bg: '#FDECEA', value: exams, label: 'exams created' },
    { mode: 'Learn', color: '#2BA888', bg: '#E1F5EE', value: courses, label: 'courses created' },
    { mode: 'Train', color: '#185FA5', bg: '#E6F1FB', value: paths, label: 'training paths' },
  ]

  const hasActivity = quizzes + exams + courses + paths > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Analytics" />

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
            {loading ? 'Loading...' : institutionName}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
            {loading ? '' : `${plan} · ${moduleCount} module${moduleCount !== 1 ? 's' : ''} active · ${userCount} user${userCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Module stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {moduleStats.map((m) => (
            <div key={m.mode} className="sphere-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: m.color, background: m.bg, padding: '3px 8px', borderRadius: 4,
                }}>
                  {m.mode}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>
                  {loading ? '...' : m.value}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{m.label}</p>
            </div>
          ))}
        </div>

        {hasActivity ? (
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Activity breakdown</h2>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
              Detailed session analytics will appear here as your institution creates and runs content.
            </p>
          </div>
        ) : (
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>
              No activity yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
              Create a quiz, exam, course, or training path to start seeing data here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
