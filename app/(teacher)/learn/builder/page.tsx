'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Suspense } from 'react'
import type { Roster } from '@/lib/types'

const THUMBNAIL_COLORS = ['#1A8966', '#2E2886', '#D97010', '#C23B2A', '#1052A3', '#18171A']
const MODULE_TYPES = [
  { type: 'video', label: 'Video', icon: '▶' },
  { type: 'reading', label: 'Reading', icon: '📄' },
  { type: 'quiz', label: 'Quiz', icon: '✓' },
  { type: 'assignment', label: 'Assignment', icon: '📝' },
  { type: 'flashcards', label: 'Flashcards', icon: '🃏' },
] as const

type ModuleType = 'video' | 'reading' | 'quiz' | 'assignment' | 'flashcards'

interface QuizItem { question: string; options: string[]; correct: number }
interface FlashCard { front: string; back: string }

interface Module {
  id: string
  title: string
  type: ModuleType
  duration_minutes: number
  is_mandatory: boolean
  content: {
    video_url?: string
    body?: string
    instructions?: string
    questions?: QuizItem[]
    cards?: FlashCard[]
  }
}

function emptyModule(): Module {
  return { id: `m-${Date.now()}`, title: '', type: 'video', duration_minutes: 10, is_mandatory: true, content: {} }
}

function emptyQuizItem(): QuizItem {
  return { question: '', options: ['', '', '', ''], correct: 0 }
}

// ── Module content editor ─────────────────────────────────────────────────────

function VideoContent({ content, onChange }: { content: Module['content']; onChange: (c: Module['content']) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 4 }}>Video URL</label>
        <input value={content.video_url ?? ''} onChange={e => onChange({ ...content, video_url: e.target.value })} placeholder="Paste a YouTube or video link" style={inputStyle} />
      </div>
    </div>
  )
}

function ReadingContent({ content, onChange }: { content: Module['content']; onChange: (c: Module['content']) => void }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 4 }}>Reading content</label>
      <textarea value={content.body ?? ''} onChange={e => onChange({ ...content, body: e.target.value })} placeholder="Paste or write the reading material here..." rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }} />
    </div>
  )
}

function AssignmentContent({ content, onChange }: { content: Module['content']; onChange: (c: Module['content']) => void }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 4 }}>Assignment instructions</label>
      <textarea value={content.instructions ?? ''} onChange={e => onChange({ ...content, instructions: e.target.value })} placeholder="Describe what students need to do, submit, or produce..." rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }} />
    </div>
  )
}

function QuizContent({ content, onChange }: { content: Module['content']; onChange: (c: Module['content']) => void }) {
  const questions = content.questions ?? []
  const COLORS = ['#2E2886', '#1A8966', '#C23B2A', '#D97010']

  function updateQuestion(qi: number, updates: Partial<QuizItem>) {
    const next = questions.map((q, i) => i === qi ? { ...q, ...updates } : q)
    onChange({ ...content, questions: next })
  }
  function updateOption(qi: number, oi: number, val: string) {
    const next = questions.map((q, i) => i !== qi ? q : { ...q, options: q.options.map((o, j) => j === oi ? val : o) })
    onChange({ ...content, questions: next })
  }
  function addQuestion() { onChange({ ...content, questions: [...questions, emptyQuizItem()] }) }
  function removeQuestion(qi: number) { onChange({ ...content, questions: questions.filter((_, i) => i !== qi) }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {questions.map((q, qi) => (
        <div key={qi} style={{ background: 'var(--page-bg)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={q.question} onChange={e => updateQuestion(qi, { question: e.target.value })} placeholder={`Question ${qi + 1}`} style={{ ...inputStyle, flex: 1, fontWeight: 500 }} />
            <button onClick={() => removeQuestion(qi)} style={{ background: 'none', border: 'none', color: '#C23B2A', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['A', 'B', 'C', 'D'].map((lbl, oi) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, background: q.correct === oi ? `${COLORS[oi]}14` : 'var(--white)', border: `0.5px solid ${q.correct === oi ? COLORS[oi] : 'var(--border)'}`, borderRadius: 7, padding: '8px 10px' }}>
                <span style={{ width: 22, height: 22, borderRadius: 5, background: COLORS[oi], color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{lbl}</span>
                <input value={q.options[oi] ?? ''} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${lbl}`} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: 'var(--near-black)' }} />
                <button onClick={() => updateQuestion(qi, { correct: oi })} title="Mark correct" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${q.correct === oi ? COLORS[oi] : 'var(--border)'}`, background: q.correct === oi ? COLORS[oi] : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addQuestion} style={{ padding: '8px 0', background: 'transparent', border: '0.5px dashed var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer' }}>+ Add question</button>
    </div>
  )
}

function FlashcardsContent({ content, onChange }: { content: Module['content']; onChange: (c: Module['content']) => void }) {
  const cards = content.cards ?? []
  function update(i: number, field: 'front' | 'back', val: string) {
    const next = cards.map((c, ci) => ci === i ? { ...c, [field]: val } : c)
    onChange({ ...content, cards: next })
  }
  function add() { onChange({ ...content, cards: [...cards, { front: '', back: '' }] }) }
  function remove(i: number) { onChange({ ...content, cards: cards.filter((_, ci) => ci !== i) }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cards.map((card, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={card.front} onChange={e => update(i, 'front', e.target.value)} placeholder="Front (question / term)" style={{ ...inputStyle, flex: 1 }} />
          <span style={{ color: 'var(--mid-grey)', fontSize: 14, flexShrink: 0 }}>→</span>
          <input value={card.back} onChange={e => update(i, 'back', e.target.value)} placeholder="Back (answer / definition)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#C23B2A', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{ padding: '8px 0', background: 'transparent', border: '0.5px dashed var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer' }}>+ Add card</button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
  borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--near-black)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

// ── Main builder ──────────────────────────────────────────────────────────────

function CourseBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailColor, setThumbnailColor] = useState('#1A8966')
  const [modules, setModules] = useState<Module[]>([])
  const [showAddModule, setShowAddModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [newModuleType, setNewModuleType] = useState<ModuleType>('video')
  const [newModuleDuration, setNewModuleDuration] = useState(10)
  const [newModuleRequired, setNewModuleRequired] = useState(true)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [error, setError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [rosterId, setRosterId] = useState<string>('')
  const [audienceGroups, setAudienceGroups] = useState<string[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [rosterGroups, setRosterGroups] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('rosters')
      .select('*')
      .eq('institution_id', getCurrentUser().institution_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRosters(data ?? []))
  }, [])

  useEffect(() => {
    if (!rosterId) { setRosterGroups([]); return }
    supabase
      .from('roster_members')
      .select('groups')
      .eq('roster_id', rosterId)
      .then(({ data }) => {
        const groups = Array.from(new Set((data ?? []).flatMap(m => m.groups ?? [])))
        setRosterGroups(groups)
      })
  }, [rosterId])

  useEffect(() => {
    if (!editId) return
    async function load() {
      const { data } = await supabase.from('courses').select('*').eq('id', editId).single()
      if (data) {
        setTitle(data.title ?? '')
        setSubject(data.subject ?? '')
        setGrade(data.grade_level ?? '')
        setDescription(data.description ?? '')
        setThumbnailColor(data.thumbnail_color ?? '#1A8966')
        setRosterId(data.roster_id ?? '')
        setAudienceGroups(data.audience_groups ?? [])
        setModules((data.modules ?? []).map((m: Module & { content: { required?: boolean } }) => ({
          id: m.id ?? `m-${Date.now()}`,
          title: m.title,
          type: m.type,
          duration_minutes: m.duration_minutes,
          is_mandatory: m.is_mandatory ?? m.content?.required ?? true,
          content: { ...m.content, required: undefined },
        })))
      }
      setLoading(false)
    }
    load()
  }, [editId])

  function updateModuleContent(id: string, content: Module['content']) {
    setModules(prev => prev.map(m => m.id === id ? { ...m, content } : m))
  }

  const addModule = useCallback(() => {
    if (!newModuleTitle.trim()) return
    const m: Module = { id: `m-${Date.now()}`, title: newModuleTitle, type: newModuleType, duration_minutes: newModuleDuration, is_mandatory: newModuleRequired, content: {} }
    setModules(prev => [...prev, m])
    setExpandedModule(m.id)
    setNewModuleTitle('')
    setNewModuleType('video')
    setNewModuleDuration(10)
    setNewModuleRequired(true)
    setShowAddModule(false)
  }, [newModuleTitle, newModuleType, newModuleDuration, newModuleRequired])

  function removeModule(idx: number) {
    const id = modules[idx].id
    setModules(prev => prev.filter((_, i) => i !== idx))
    if (expandedModule === id) setExpandedModule(null)
  }

  function moveModule(from: number, to: number) {
    if (to < 0 || to >= modules.length) return
    setModules(prev => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n })
  }

  function openPreview() {
    const previewData = {
      id: editId ?? 'preview',
      title: title || 'Untitled course',
      subject, grade_level: grade, description,
      thumbnail_color: thumbnailColor,
      modules,
      is_published: false,
      institution_id: '', creator_id: '', created_at: '',
    }
    sessionStorage.setItem('sphere_course_preview', JSON.stringify(previewData))
    window.open('/student/learn/preview', '_blank')
  }

  async function save(publish: boolean) {
    if (!title.trim()) { setError('Give your course a title first.'); return }
    setSaving(true); setError('')

    const payload = {
      institution_id: getCurrentUser().institution_id,
      creator_id: getCurrentUser().id,
      title, subject, grade_level: grade, description,
      thumbnail_color: thumbnailColor,
      modules: modules.map(({ is_mandatory, ...m }) => ({ ...m, is_mandatory })),
      is_published: publish,
      roster_id: rosterId || null,
      audience_groups: rosterId ? audienceGroups : null,
      updated_at: new Date().toISOString(),
    }

    let dbError
    if (editId) {
      const res = await supabase.from('courses').update(payload).eq('id', editId)
      dbError = res.error
    } else {
      const res = await supabase.from('courses').insert({ ...payload, created_at: new Date().toISOString() })
      dbError = res.error
    }
    setSaving(false)
    if (dbError) { setError(`Could not save: ${dbError.message}`); return }
    router.push('/learn')
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your course...</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title={editId ? 'Edit course' : 'Course builder'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={openPreview}>Preview as student</Button>
            <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Save draft'}
            </Button>
            <Button accent="#1A8966" size="sm" onClick={() => save(true)} disabled={saving}>
              {saving ? 'Publishing...' : 'Publish course'}
            </Button>
          </div>
        }
      />

      {error && <div style={{ background: '#FDECEA', color: '#C23B2A', fontSize: 13, padding: '10px 32px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 24, padding: '28px 32px', maxWidth: 1100, alignItems: 'flex-start' }}>
        {/* Left panel — course meta */}
        <div style={{ width: 300, flexShrink: 0, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: thumbnailColor, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{title ? title[0].toUpperCase() : '?'}</span>
          </div>
          <div style={{ padding: '18px 18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Thumbnail colour</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {THUMBNAIL_COLORS.map(c => (
                  <button key={c} onClick={() => setThumbnailColor(c)} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: thumbnailColor === c ? '2px solid var(--near-black)' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Course title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's this course called?" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Grade</label>
                <input value={grade} onChange={e => setGrade(e.target.value)} placeholder="e.g. JHS 1" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What will students learn?" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }} />
            </div>

            <div>
              <label style={labelStyle}>Roster (optional)</label>
              <select value={rosterId} onChange={e => { setRosterId(e.target.value); setAudienceGroups([]) }} style={inputStyle}>
                <option value="">No roster, invite students manually</option>
                {rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 5, lineHeight: 1.4 }}>
                {rosterId
                  ? 'You can bulk-enroll this roster from the class management page.'
                  : 'Tying this course to a roster lets you enroll a whole class in one click.'}
              </p>
              {rosters.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 4 }}>
                  No rosters yet. <a href="/students" style={{ color: '#2E2886' }}>Create one first.</a>
                </p>
              )}
              {rosterId && rosterGroups.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {rosterGroups.map(g => {
                    const active = audienceGroups.includes(g)
                    return (
                      <button
                        key={g}
                        onClick={() => setAudienceGroups(prev => active ? prev.filter(x => x !== g) : [...prev, g])}
                        style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12, border: '0.5px solid #2E288640', background: active ? '#2E2886' : '#fff', color: active ? '#fff' : '#2E2886', cursor: 'pointer' }}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — modules */}
        <div style={{ flex: 1 }}>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                Modules <span style={{ fontWeight: 400, color: 'var(--mid-grey)', fontSize: 13 }}>({modules.length})</span>
              </span>
              <Button accent="#1A8966" size="sm" onClick={() => setShowAddModule(true)}>+ Add module</Button>
            </div>

            {modules.length === 0 && !showAddModule && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                No modules yet. Add a video, reading, or quiz to get started.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modules.map((mod, idx) => {
                const typeInfo = MODULE_TYPES.find(t => t.type === mod.type)
                const isExpanded = expandedModule === mod.id
                return (
                  <div key={mod.id} style={{ background: 'var(--page-bg)', border: `0.5px solid ${isExpanded ? '#1A8966' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', opacity: dragIndex === idx ? 0.5 : 1 }}
                    draggable onDragStart={() => setDragIndex(idx)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIndex !== null && dragIndex !== idx) moveModule(dragIndex, idx); setDragIndex(null) }} onDragEnd={() => setDragIndex(null)}>
                    {/* Module header */}
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpandedModule(isExpanded ? null : mod.id)}>
                      <span style={{ color: 'var(--mid-grey)', fontSize: 16, cursor: 'grab' }}>⠿</span>
                      <span style={{ fontSize: 15 }}>{typeInfo?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{mod.title || 'Untitled module'}</div>
                        <div style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{mod.duration_minutes} min</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#1A8966', background: '#DDFAF0', padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>{mod.type}</span>
                      {mod.is_mandatory && <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 4 }}>Required</span>}
                      <span style={{ fontSize: 14, color: isExpanded ? '#1A8966' : 'var(--mid-grey)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                      <button onClick={e => { e.stopPropagation(); removeModule(idx) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C23B2A', fontSize: 18, padding: 4, lineHeight: 1 }}>×</button>
                    </div>

                    {/* Content editor */}
                    {isExpanded && (
                      <div style={{ padding: '0 14px 16px', borderTop: '0.5px solid var(--border)' }}>
                        <div style={{ paddingTop: 14 }}>
                          {mod.type === 'video' && <VideoContent content={mod.content} onChange={c => updateModuleContent(mod.id, c)} />}
                          {mod.type === 'reading' && <ReadingContent content={mod.content} onChange={c => updateModuleContent(mod.id, c)} />}
                          {mod.type === 'assignment' && <AssignmentContent content={mod.content} onChange={c => updateModuleContent(mod.id, c)} />}
                          {mod.type === 'quiz' && <QuizContent content={mod.content} onChange={c => updateModuleContent(mod.id, c)} />}
                          {mod.type === 'flashcards' && <FlashcardsContent content={mod.content} onChange={c => updateModuleContent(mod.id, c)} />}
                        </div>
                        {/* Module metadata edit */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                          <input value={mod.title} onChange={e => setModules(p => p.map(m => m.id === mod.id ? { ...m, title: e.target.value } : m))} placeholder="Module title" style={{ ...inputStyle, flex: 1 }} onClick={e => e.stopPropagation()} />
                          <input type="number" value={mod.duration_minutes} onChange={e => setModules(p => p.map(m => m.id === mod.id ? { ...m, duration_minutes: Number(e.target.value) } : m))} min={1} style={{ ...inputStyle, width: 70 }} onClick={e => e.stopPropagation()} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={mod.is_mandatory} onChange={e => setModules(p => p.map(m => m.id === mod.id ? { ...m, is_mandatory: e.target.checked } : m))} /> Required
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add module form */}
            {showAddModule && (
              <div style={{ marginTop: 16, background: 'var(--page-bg)', border: '0.5px solid #1A8966', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12 }}>New module</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input value={newModuleTitle} onChange={e => setNewModuleTitle(e.target.value)} placeholder="Module title" style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
                  <select value={newModuleType} onChange={e => setNewModuleType(e.target.value as ModuleType)} style={{ flex: 1, minWidth: 120, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
                    {MODULE_TYPES.map(t => <option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
                  </select>
                  <input type="number" value={newModuleDuration} onChange={e => setNewModuleDuration(Number(e.target.value))} min={1} placeholder="min" style={{ ...inputStyle, width: 70 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mid-grey)', marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={newModuleRequired} onChange={e => setNewModuleRequired(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Required to complete course
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button accent="#1A8966" size="sm" onClick={addModule}>Add module</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddModule(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 5 }

export default function CourseBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mid-grey)' }}>Loading course builder...</div>}>
      <CourseBuilderInner />
    </Suspense>
  )
}
