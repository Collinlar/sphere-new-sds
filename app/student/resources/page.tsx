'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchPublishedResourcesForStudent, type StudentResourceItem } from '@/lib/student-resources'

const TYPE_LABEL: Record<string, string> = {
  guide: 'Guide',
  notes: 'Notes',
  document: 'Document',
}

const TYPE_COLOR: Record<string, string> = {
  guide: '#1052A3',
  notes: '#2E2886',
  document: '#D97010',
}

export default function StudentResourcesPage() {
  const [items, setItems] = useState<StudentResourceItem[]>([])
  const [filter, setFilter] = useState<'all' | 'guide' | 'notes' | 'document'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublishedResourcesForStudent().then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter)

  return (
    <div style={{ padding: '24px 16px 40px' }}>
      <Link href="/student/learn" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
        ← Back to Learn
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginTop: 14, marginBottom: 6 }}>
        Reading materials
      </h1>
      <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 20, lineHeight: 1.5 }}>
        Guides, notes, and documents your teachers have published for you.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {(['all', 'guide', 'notes', 'document'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 20,
              border: 'none',
              background: filter === key ? 'var(--near-black)' : 'var(--white)',
              color: filter === key ? '#fff' : 'var(--mid-grey)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            {key === 'all' ? 'All' : TYPE_LABEL[key]}
          </button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading your materials...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', boxShadow: 'var(--shadow-soft)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>Nothing published yet</p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>When your teachers publish guides or notes, they will show up here.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((item) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={`/student/resources/${item.type}/${item.id}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: 4, background: TYPE_COLOR[item.type] ?? '#1A8966', flexShrink: 0 }} />
              <div style={{ padding: '14px 14px 14px 12px', flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: item.cover_color || TYPE_COLOR[item.type],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {item.title[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                    {TYPE_LABEL[item.type]}
                    {item.subject ? ` · ${item.subject}` : ''}
                    {item.grade_level ? ` · ${item.grade_level}` : ''}
                  </p>
                </div>
                <span style={{ color: 'var(--mid-grey)', fontSize: 18 }}>›</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
