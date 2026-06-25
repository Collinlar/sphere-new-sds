'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'

const DEMO = '00000000-0000-0000-0000-000000000001'

export default function ContentLibraryPage() {
  const [activeTab, setActiveTab] = useState<'quizzes' | 'exams' | 'courses' | 'paths'>('quizzes')
  const [data, setData] = useState<Record<string, unknown[]>>({ quizzes: [], exams: [], courses: [], paths: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [q, e, c, p] = await Promise.all([
        supabase.from('quizzes').select('*').eq('institution_id', DEMO).order('created_at', { ascending: false }),
        supabase.from('exams').select('*').eq('institution_id', DEMO).order('created_at', { ascending: false }),
        supabase.from('courses').select('*').eq('institution_id', DEMO).order('created_at', { ascending: false }),
        supabase.from('learning_paths').select('*').eq('institution_id', DEMO).order('created_at', { ascending: false }),
      ])
      setData({
        quizzes: q.data ?? [],
        exams: e.data ?? [],
        courses: c.data ?? [],
        paths: p.data ?? [],
      })
      setLoading(false)
    }
    load()
  }, [])

  const TABS = [
    { key: 'quizzes', label: 'Quizzes', color: '#EF9F27', href: '/engage/builder' },
    { key: 'exams', label: 'Exams', color: '#E05C4B', href: '/assess/create' },
    { key: 'courses', label: 'Courses', color: '#2BA888', href: '/learn/builder' },
    { key: 'paths', label: 'Training paths', color: '#185FA5', href: '/train/builder' },
  ]

  const current = TABS.find((t) => t.key === activeTab)!

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Content library" />

      <div style={{ padding: '28px 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--white)', borderRadius: 10, padding: 4, width: 'fit-content', border: '0.5px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              style={{
                padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: activeTab === t.key ? t.color : 'transparent',
                color: activeTab === t.key ? '#fff' : 'var(--mid-grey)',
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--font)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600,
                color: activeTab === t.key ? 'rgba(255,255,255,0.8)' : 'var(--mid-grey)',
              }}>
                {data[t.key].length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Scanning your content library...</p>
        ) : data[activeTab].length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--near-black)', marginBottom: 8 }}>
              No {activeTab} yet
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 20 }}>
              Create your first one to see it here
            </p>
            <a href={current.href} style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 8,
              background: current.color, color: '#fff', textDecoration: 'none',
              fontSize: 14, fontWeight: 500,
            }}>
              Create {activeTab.slice(0, -1)}
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {(data[activeTab] as Record<string, unknown>[]).map((item) => (
              <div key={item.id as string} className="sphere-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.3 }}>
                    {(item.title ?? item.name) as string}
                  </h3>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '2px 7px', borderRadius: 4,
                    background: item.is_published ? '#E1F5EE' : 'var(--bg2)',
                    color: item.is_published ? '#0A4A38' : 'var(--mid-grey)',
                  }}>
                    {item.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {(item.subject as string | undefined) && (
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 6 }}>
                    {item.subject as string} {item.grade_level ? `· ${item.grade_level as string}` : ''}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--mid-grey)' }}>
                  Created {new Date(item.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
