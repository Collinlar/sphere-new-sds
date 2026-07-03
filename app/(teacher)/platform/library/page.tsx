'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { decrementUsed } from '@/lib/subscription'
import {
  createDocument,
  createGuide,
  createNote,
  deleteContentResource,
  fetchDocuments,
  fetchGuides,
  fetchNotes,
  getContentBuilderHref,
} from '@/lib/content-resources'

export default function ContentLibraryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'quizzes' | 'exams' | 'courses' | 'paths' | 'guides' | 'notes' | 'documents'>('quizzes')
  const [data, setData] = useState<Record<string, unknown[]>>({
    quizzes: [], exams: [], courses: [], paths: [], guides: [], notes: [], documents: [],
  })
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadLibrary() {
    const institutionId = getCurrentUser().institution_id
    const [q, e, c, p, g, n, d] = await Promise.all([
      supabase.from('quizzes').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('exams').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('courses').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('learning_paths').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      fetchGuides(institutionId),
      fetchNotes(institutionId),
      fetchDocuments(institutionId),
    ])
    setData({
      quizzes: q.data ?? [],
      exams: e.data ?? [],
      courses: c.data ?? [],
      paths: p.data ?? [],
      guides: g,
      notes: n,
      documents: d,
    })
    setLoading(false)
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  const MODULE_FOR_TAB: Partial<Record<string, 'assess' | 'engage' | 'learn' | 'train'>> = {
    quizzes: 'engage',
    exams: 'assess',
    courses: 'learn',
    paths: 'train',
  }

  const TABLE_FOR_TAB: Partial<Record<string, 'quizzes' | 'exams' | 'courses' | 'learning_paths' | 'guides' | 'notes' | 'documents'>> = {
    quizzes: 'quizzes',
    exams: 'exams',
    courses: 'courses',
    paths: 'learning_paths',
    guides: 'guides',
    notes: 'notes',
    documents: 'documents',
  }

  async function handleDelete(id: string) {
    const table = TABLE_FOR_TAB[activeTab]
    if (!table) return
    setDeletingId(id)
    const result = await deleteContentResource(table, id)
    if (result.ok) {
      const module = MODULE_FOR_TAB[activeTab]
      if (module) await decrementUsed(module)
      await loadLibrary()
    }
    setDeletingId(null)
  }

  async function handleQuickCreate() {
    const title = window.prompt(`Title for your new ${activeTab.slice(0, -1)}?`)
    if (!title?.trim()) return
    if (activeTab === 'guides') {
      const result = await createGuide({ title: title.trim() })
      if (result.ok) router.push(getContentBuilderHref('guides', result.id)!)
    }
    if (activeTab === 'notes') {
      const result = await createNote({ title: title.trim() })
      if (result.ok) router.push(getContentBuilderHref('notes', result.id)!)
    }
    if (activeTab === 'documents') {
      const result = await createDocument({ title: title.trim() })
      if (result.ok) router.push(getContentBuilderHref('documents', result.id)!)
    }
  }

  function getEditHref(tab: string, id: string): string | null {
    if (tab === 'quizzes') return `/engage/builder?id=${id}`
    if (tab === 'exams') return `/assess/create?id=${id}`
    if (tab === 'courses') return `/learn/builder?id=${id}`
    if (tab === 'paths') return `/train/builder?id=${id}`
    return getContentBuilderHref(tab, id)
  }

  const TABS = [
    { key: 'quizzes', label: 'Quizzes', color: '#D97010', href: '/engage/builder' },
    { key: 'exams', label: 'Exams', color: '#C23B2A', href: '/assess/create' },
    { key: 'courses', label: 'Courses', color: '#1A8966', href: '/learn/builder' },
    { key: 'paths', label: 'Training paths', color: '#1052A3', href: '/train/builder' },
    { key: 'guides', label: 'Guides', color: '#1052A3', href: '' },
    { key: 'notes', label: 'Notes', color: '#2E2886', href: '' },
    { key: 'documents', label: 'Documents', color: '#D97010', href: '' },
  ]

  const current = TABS.find((t) => t.key === activeTab)!

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Content library" />

      <div style={{ padding: '28px 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
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
            <a href={current.href || '#'} onClick={(e) => { if (!current.href) { e.preventDefault(); handleQuickCreate() } }} style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 8,
              background: current.color, color: '#fff', textDecoration: 'none',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            }}>
              Create {current.label.slice(0, -1).toLowerCase()}
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {(data[activeTab] as Record<string, unknown>[]).map((item) => {
              const editHref = getEditHref(activeTab, item.id as string)
              return (
              <div key={item.id as string} style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.3 }}>
                    {editHref ? (
                      <Link href={editHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {(item.title ?? item.name) as string}
                      </Link>
                    ) : (
                      (item.title ?? item.name) as string
                    )}
                  </h3>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '3px 9px', borderRadius: 20,
                    background: item.is_published ? '#DDFAF0' : 'var(--bg2)',
                    color: item.is_published ? '#1A8966' : 'var(--mid-grey)',
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
                {TABLE_FOR_TAB[activeTab] && (
                  <button
                    onClick={() => handleDelete(item.id as string)}
                    disabled={deletingId === item.id}
                    style={{
                      marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--coral)',
                      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                    }}
                  >
                    {deletingId === item.id ? 'Removing...' : 'Remove from library'}
                  </button>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
