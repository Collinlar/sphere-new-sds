'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { onContextChange } from '@/lib/context'
import {
  applyScopeToQuery,
  fetchScopedContent,
  resolveLibraryScope,
  type LibraryScope,
} from '@/lib/library-scope'
import { canAccessModule } from '@/lib/subscription'
import { isAcquiredRow, getAcquisitionUseHref, getAcquisitionTakeLabel, fetchAcquiredContentIds, type AcquisitionKind } from '@/lib/acquisition-access'
import { decrementUsed } from '@/lib/subscription'
import {
  createDocument,
  createGuide,
  createNote,
  deleteContentResource,
  getContentBuilderHref,
} from '@/lib/content-resources'

export default function ContentLibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const validTabs = ['quizzes', 'exams', 'courses', 'paths', 'guides', 'notes', 'documents'] as const
  const initialTab = validTabs.includes(tabParam as typeof validTabs[number])
    ? (tabParam as typeof validTabs[number])
    : 'quizzes'
  const [activeTab, setActiveTab] = useState<typeof validTabs[number]>(initialTab)
  const [data, setData] = useState<Record<string, unknown[]>>({
    quizzes: [], exams: [], courses: [], paths: [], guides: [], notes: [], documents: [],
  })
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [scopeLabel, setScopeLabel] = useState('Personal library')
  const [moduleAccess, setModuleAccess] = useState<Record<string, boolean>>({
    engage: true,
    assess: false,
    learn: false,
    train: false,
  })
  const [acquiredIds, setAcquiredIds] = useState<Set<string>>(new Set())

  async function loadLibrary(scope?: LibraryScope) {
    const libraryScope = scope ?? resolveLibraryScope()
    setScopeLabel(libraryScope.label)
    setLoading(true)

    const [engage, assess, learn, train] = await Promise.all([
      canAccessModule('engage'),
      canAccessModule('assess'),
      canAccessModule('learn'),
      canAccessModule('train'),
    ])
    setModuleAccess({ engage, assess, learn, train })

    let guidesQuery = supabase.from('guides').select('*')
    guidesQuery = applyScopeToQuery(guidesQuery, libraryScope)
    let notesQuery = supabase.from('notes').select('*')
    notesQuery = applyScopeToQuery(notesQuery, libraryScope)
    let documentsQuery = supabase.from('documents').select('*')
    documentsQuery = applyScopeToQuery(documentsQuery, libraryScope)

    const [q, e, c, p, g, n, d, acquired] = await Promise.all([
      fetchScopedContent('quizzes', libraryScope),
      fetchScopedContent('exams', libraryScope),
      fetchScopedContent('courses', libraryScope),
      fetchScopedContent('learning_paths', libraryScope),
      guidesQuery.order('updated_at', { ascending: false }),
      notesQuery.order('updated_at', { ascending: false }),
      documentsQuery.order('updated_at', { ascending: false }),
      fetchAcquiredContentIds(libraryScope),
    ])

    setAcquiredIds(acquired)

    setData({
      quizzes: q,
      exams: e,
      courses: c,
      paths: p,
      guides: g.data ?? [],
      notes: n.data ?? [],
      documents: d.data ?? [],
    })
    setLoading(false)
  }

  useEffect(() => {
    loadLibrary()
    return onContextChange(() => loadLibrary())
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

  const TAB_KIND: Partial<Record<string, AcquisitionKind>> = {
    quizzes: 'quiz',
    exams: 'exam',
    courses: 'course',
    paths: 'path',
  }

  function getBuilderHref(tab: string, id: string): string | null {
    if (tab === 'quizzes') return `/engage/builder?id=${id}`
    if (tab === 'exams') return `/assess/create?id=${id}`
    if (tab === 'courses') return `/learn/builder?id=${id}`
    if (tab === 'paths') return `/train/builder?id=${id}`
    return getContentBuilderHref(tab, id)
  }

  function getItemHref(tab: string, item: Record<string, unknown>): string {
    const module = MODULE_FOR_TAB[tab]
    const acquired = isItemAcquired(item)
    const kind = TAB_KIND[tab]

    // Acquired content is for use first. Edit stays available via the Edit link when the module is unlocked.
    if (acquired && kind) {
      return getAcquisitionUseHref(kind, item.id as string)
    }

    if (module && !moduleAccess[module]) {
      return `/platform/settings/billing?locked=${module}`
    }

    return getBuilderHref(tab, item.id as string) ?? '#'
  }

  function isItemAcquired(item: Record<string, unknown>): boolean {
    return acquiredIds.has(item.id as string) || isAcquiredRow(item)
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

  function isTabLocked(tab: string): boolean {
    const module = MODULE_FOR_TAB[tab]
    return module ? !moduleAccess[module] : false
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
        <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 16 }}>{scopeLabel}</p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
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
              {isTabLocked(activeTab)
                ? 'Import from the marketplace or upgrade to create your own'
                : 'Create your first one to see it here'}
            </p>
            {isTabLocked(activeTab) ? (
              <Link href="/platform/marketplace" style={{
                display: 'inline-block', padding: '10px 20px', borderRadius: 8,
                background: current.color, color: '#fff', textDecoration: 'none',
                fontSize: 14, fontWeight: 500,
              }}>
                Browse marketplace
              </Link>
            ) : (
              <a href={current.href || '#'} onClick={(e) => { if (!current.href) { e.preventDefault(); handleQuickCreate() } }} style={{
                display: 'inline-block', padding: '10px 20px', borderRadius: 8,
                background: current.color, color: '#fff', textDecoration: 'none',
                fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              }}>
                Create {current.label.slice(0, -1).toLowerCase()}
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {(data[activeTab] as Record<string, unknown>[]).map((item) => {
              const tabLocked = isTabLocked(activeTab)
              const acquired = isItemAcquired(item)
              const kind = TAB_KIND[activeTab]
              const useHref = acquired && kind ? getAcquisitionUseHref(kind, item.id as string) : null
              const useLabel = kind ? getAcquisitionTakeLabel(kind) : 'Open'
              const itemHref = getItemHref(activeTab, item)
              const editHref = !tabLocked ? getBuilderHref(activeTab, item.id as string) : null
              return (
              <div key={item.id as string} style={{
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                borderRadius: 10,
                padding: 18,
                opacity: tabLocked && !acquired ? 0.92 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.3 }}>
                    <Link href={itemHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {(item.title ?? item.name) as string}
                    </Link>
                  </h3>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '3px 9px', borderRadius: 20, flexShrink: 0,
                    background: acquired ? '#DDFAF0' : tabLocked ? '#FEF0DC' : item.is_published ? '#DDFAF0' : 'var(--bg2)',
                    color: acquired ? '#1A8966' : tabLocked ? '#9A5800' : item.is_published ? '#1A8966' : 'var(--mid-grey)',
                  }}>
                    {acquired ? 'From marketplace' : tabLocked ? 'Saved' : item.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {acquired && (
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 8, lineHeight: 1.5 }}>
                    {tabLocked
                      ? 'Take this on your own. Upgrade to host it for a class or edit it.'
                      : 'Imported or purchased. Use it now, or edit if you want to customise it.'}
                  </p>
                )}
                {tabLocked && !acquired && (
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 8, lineHeight: 1.5 }}>
                    Upgrade to open and edit
                  </p>
                )}
                {(item.subject as string | undefined) && (
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 6 }}>
                    {item.subject as string} {item.grade_level ? `· ${item.grade_level as string}` : ''}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--mid-grey)' }}>
                  {acquired ? 'Added' : 'Created'}{' '}
                  {new Date(item.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {useHref && (
                  <Link href={useHref} style={{
                    display: 'inline-block', marginTop: 10, marginRight: 12, fontSize: 12, fontWeight: 700,
                    color: 'var(--teal)', textDecoration: 'none',
                  }}>
                    {useLabel}
                  </Link>
                )}
                {tabLocked && !acquired && (
                  <Link href={itemHref} style={{
                    display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600,
                    color: 'var(--amber)', textDecoration: 'none',
                  }}>
                    See upgrade options
                  </Link>
                )}
                {editHref && (
                  <Link href={editHref} style={{
                    display: 'inline-block', marginTop: 10, marginRight: 12, fontSize: 12, fontWeight: 600,
                    color: 'var(--mid-grey)', textDecoration: 'none',
                  }}>
                    Edit
                  </Link>
                )}
                {TABLE_FOR_TAB[activeTab] && (!tabLocked || acquired) && (
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
