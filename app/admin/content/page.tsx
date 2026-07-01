'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ContentType = 'exams' | 'quizzes' | 'courses' | 'learning_paths' | 'guides' | 'notes' | 'documents'

interface ContentRow {
  id: string
  title: string
  created_at: string
  status?: string
  is_published?: boolean
  marketplace_listing_id?: string
  users?: { name: string }
  institutions?: { name: string }
}

const TABS: { key: ContentType; label: string; color: string }[] = [
  { key: 'exams', label: 'Exams', color: '#C23B2A' },
  { key: 'quizzes', label: 'Quizzes', color: '#D97010' },
  { key: 'courses', label: 'Courses', color: '#1A8966' },
  { key: 'learning_paths', label: 'Training paths', color: '#1052A3' },
  { key: 'guides', label: 'Guides', color: '#2E2886' },
  { key: 'notes', label: 'Notes', color: '#A09DA8' },
  { key: 'documents', label: 'Documents', color: '#6B6870' },
]

const TABLE_QUERIES: Record<ContentType, { table: string; select: string }> = {
  exams: { table: 'exams', select: 'id, title, created_at, users(name), institutions(name)' },
  quizzes: { table: 'quizzes', select: 'id, title, created_at, users(name), institutions(name)' },
  courses: { table: 'courses', select: 'id, title, created_at, is_published, users(name), institutions(name)' },
  learning_paths: { table: 'learning_paths', select: 'id, title, created_at, is_published, users(name), institutions(name)' },
  guides: { table: 'guides', select: 'id, title, created_at, is_published, users(name), institutions(name)' },
  notes: { table: 'notes', select: 'id, title, created_at, is_published, users(name), institutions(name)' },
  documents: { table: 'documents', select: 'id, title, created_at, users(name), institutions(name)' },
}

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentType>('exams')
  const [data, setData] = useState<ContentRow[]>([])
  const [counts, setCounts] = useState<Record<ContentType, number>>({} as Record<ContentType, number>)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Load counts for all tabs
    Promise.all(
      TABS.map(t => supabase.from(TABLE_QUERIES[t.key].table).select('id', { count: 'exact', head: true }))
    ).then(results => {
      const c = {} as Record<ContentType, number>
      TABS.forEach((t, i) => { c[t.key] = results[i].count ?? 0 })
      setCounts(c)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    setSearch('')
    const { table, select } = TABLE_QUERIES[activeTab]
    supabase
      .from(table)
      .select(select)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data: rows }) => {
        setData((rows ?? []) as unknown as ContentRow[])
        setLoading(false)
      })
  }, [activeTab])

  const filtered = data.filter(row => !search || row.title.toLowerCase().includes(search.toLowerCase()))
  const tabColor = TABS.find(t => t.key === activeTab)?.color ?? '#A09DA8'

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Content</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              height: 34, padding: '0 14px', borderRadius: 20, border: 'none',
              background: active ? t.color : 'var(--white)',
              color: active ? '#fff' : 'var(--mid-grey)',
              fontSize: 12, fontWeight: active ? 700 : 400,
              cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
            }}>
              {t.label} {counts[t.key] != null ? `(${counts[t.key]})` : ''}
            </button>
          )
        })}
      </div>

      <input
        placeholder={`Search ${activeTab}...`}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', maxWidth: 340, height: 38, background: 'var(--white)',
          border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 14px',
          fontSize: 13, color: 'var(--near-black)', fontFamily: 'inherit',
          boxSizing: 'border-box', marginBottom: 14,
        }}
      />

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Title', 'Creator', 'Institution', 'Status', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isPublished = row.is_published ?? true
                const hasMarketplace = !!row.marketplace_listing_id
                return (
                  <tr key={row.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{row.title}</p>
                      {hasMarketplace && <p style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 600, marginTop: 2 }}>On marketplace</p>}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(row as { users?: { name: string } }).users?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(row as { institutions?: { name: string } }).institutions?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {'is_published' in row ? (
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isPublished ? tabColor : 'var(--text-tertiary)', background: isPublished ? `${tabColor}15` : 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No {activeTab} found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
