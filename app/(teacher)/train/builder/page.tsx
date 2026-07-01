'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PathStep } from '@/lib/types'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import StepContentFields from '@/components/train/StepContentFields'
import { getCurrentUser } from '@/lib/auth'
import { incrementUsed } from '@/lib/subscription'
import CreationGate from '@/components/brand/CreationGate'
import {
  defaultStepContent,
  normalizeSteps,
  stepHasContent,
  syncPathEnrollments,
  parseAssignedDepartments,
  sanitizeStepContent,
  type TrainStepType,
} from '@/lib/train-paths'

const STEP_TYPES = [
  { type: 'video' as const, label: 'Video' },
  { type: 'reading' as const, label: 'Reading' },
  { type: 'quiz' as const, label: 'Quiz' },
  { type: 'sign_off' as const, label: 'Sign-off' },
  { type: 'assessment' as const, label: 'Assessment' },
]

const CATEGORIES = ['Compliance', 'Onboarding', 'Skills', 'Leadership']
const DEPARTMENTS = ['All staff', 'Sales', 'Operations', 'Finance', 'Customer Support', 'HR', 'Engineering']

interface NewStep {
  title: string
  type: TrainStepType
  duration_minutes: number
  is_mandatory: boolean
  content: Record<string, unknown>
}

const DEFAULT_STEP: NewStep = {
  title: '',
  type: 'video',
  duration_minutes: 10,
  is_mandatory: true,
  content: defaultStepContent('video'),
}

function TrainBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathId = searchParams.get('id')

  const [loadingPath, setLoadingPath] = useState(!!pathId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Compliance')
  const [isMandatory, setIsMandatory] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [steps, setSteps] = useState<PathStep[]>([])
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStep, setNewStep] = useState<NewStep>(DEFAULT_STEP)
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null)
  const [assignedDepts, setAssignedDepts] = useState<string[]>(['All staff'])
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pathId) return

    async function loadPath() {
      setLoadingPath(true)
      const { data, error: loadError } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('id', pathId)
        .single()

      if (loadError || !data) {
        setError('Could not load this path. It may have been removed.')
        setLoadingPath(false)
        return
      }

      setTitle(data.title ?? '')
      setDescription(data.description ?? '')
      setCategory(data.category ?? 'Compliance')
      setIsMandatory(data.is_mandatory ?? true)
      setDueDate(data.due_date ?? '')
      setSteps(normalizeSteps(data.steps))
      setAssignedDepts(parseAssignedDepartments(data))
      setLoadingPath(false)
    }

    loadPath()
  }, [pathId])

  const toggleDept = (dept: string) => {
    setAssignedDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  const addStep = useCallback(() => {
    if (!newStep.title.trim()) {
      setError('Give this step a title before adding it.')
      return
    }
    if (!stepHasContent({ ...newStep, id: 'temp', content: newStep.content } as PathStep)) {
      setError('Add the module content for this step type before saving it.')
      return
    }
    setSteps(prev => [
      ...prev,
      {
        id: `st-${Date.now()}`,
        title: newStep.title.trim(),
        type: newStep.type,
        content: sanitizeStepContent(newStep.type, newStep.content),
        duration_minutes: newStep.duration_minutes,
        is_mandatory: newStep.is_mandatory,
      },
    ])
    setNewStep({ ...DEFAULT_STEP, content: defaultStepContent('video') })
    setShowAddStep(false)
    setError('')
  }, [newStep])

  const updateStep = (idx: number, patch: Partial<PathStep>) => {
    setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx))
    if (editingStepIdx === idx) setEditingStepIdx(null)
  }

  async function savePath(publish: boolean, gateCheck?: () => Promise<boolean>) {
    if (!title.trim()) { setError('Give your training path a title first.'); return }
    if (steps.length === 0) { setError('Add at least one step with content before saving.'); return }
    if (!pathId && gateCheck) {
      const allowed = await gateCheck()
      if (!allowed) return
    }

    const missingContent = steps.find(s => !stepHasContent(s))
    if (missingContent) {
      setError(`"${missingContent.title}" is missing module content. Edit it before saving.`)
      return
    }

    const setter = publish ? setPublishing : setSaving
    setter(true)
    setError('')

    const payload = {
      institution_id: getCurrentUser().institution_id,
      creator_id: getCurrentUser().id,
      title: title.trim(),
      description,
      category,
      steps: steps.map(s => ({ ...s, content: sanitizeStepContent(s.type, s.content) })),
      is_mandatory: isMandatory,
      due_date: dueDate || null,
      assigned_departments: assignedDepts,
      updated_at: new Date().toISOString(),
    }

    let savedId = pathId

    if (pathId) {
      const { error: dbError } = await supabase.from('learning_paths').update(payload).eq('id', pathId)
      if (dbError) {
        setter(false)
        setError('Could not save right now. Check your connection and try again.')
        return
      }
    } else {
      const { data, error: dbError } = await supabase.from('learning_paths').insert([payload]).select('id').single()
      if (dbError || !data) {
        setter(false)
        setError('Could not save right now. Check your connection and try again.')
        return
      }
      savedId = data.id as string
    }

    if (publish && savedId) {
      await syncPathEnrollments(savedId, getCurrentUser().institution_id, assignedDepts)
    }

    setter(false)
    if (!pathId) await incrementUsed('train')
    router.push('/train')
  }

  if (loadingPath) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Loading path details...</p>
      </div>
    )
  }

  return (
    <CreationGate module="train">
      {({ check }) => (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="train"
        title={pathId ? 'Edit path' : 'Path builder'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => savePath(false, check)} disabled={saving}>
              {saving ? 'Saving...' : 'Save draft'}
            </Button>
            <Button accent="#1052A3" size="sm" onClick={() => savePath(true, check)} disabled={publishing}>
              {publishing ? 'Publishing...' : pathId ? 'Save and assign' : 'Publish path'}
            </Button>
          </div>
        }
      />

      {error && (
        <div style={{ background: '#FDECEA', color: '#C23B2A', fontSize: 13, padding: '10px 32px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, padding: '28px 32px', maxWidth: 1100, alignItems: 'flex-start' }}>
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '20px 20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Path details</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>Path title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What is this training called?"
                style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--near-black)' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What will employees learn or complete?"
                rows={3}
                style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--near-black)' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>Category</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    style={{
                      padding: '5px 12px', fontSize: 12, fontWeight: category === c ? 600 : 400,
                      color: category === c ? '#fff' : 'var(--mid-grey)',
                      background: category === c ? '#1052A3' : 'var(--bg2)',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--near-black)' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} style={{ width: 16, height: 16 }} />
              Mandatory for all assigned employees
            </label>
          </div>

          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 14 }}>Assign to team</div>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 12, lineHeight: 1.5 }}>
              Selected teams are enrolled when you publish or save and assign.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEPARTMENTS.map(dept => (
                <label key={dept} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--near-black)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={assignedDepts.includes(dept)} onChange={() => toggleDept(dept)} style={{ width: 16, height: 16, accentColor: '#1052A3' }} />
                  {dept}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>
                Steps <span style={{ fontWeight: 400, color: 'var(--mid-grey)', fontSize: 13 }}>({steps.length})</span>
              </div>
              <Button accent="#1052A3" size="sm" onClick={() => { setShowAddStep(true); setEditingStepIdx(null) }}>+ Add step</Button>
            </div>

            {steps.length === 0 && !showAddStep && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                No steps yet. Add a video, reading, quiz, or sign-off with its actual content.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => (
                <div key={step.id} style={{ background: 'var(--page-bg)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', width: 20, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                        {step.type.replace('_', ' ')} · {step.duration_minutes} min
                        {!stepHasContent(step) && <span style={{ color: 'var(--coral)', marginLeft: 8 }}>Needs content</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingStepIdx(editingStepIdx === idx ? null : idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1052A3', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      {editingStepIdx === idx ? 'Close' : 'Edit content'}
                    </button>
                    <button type="button" onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C23B2A', fontSize: 16, padding: 4 }}>×</button>
                  </div>

                  {editingStepIdx === idx && (
                    <div style={{ padding: '0 14px 14px', borderTop: '0.5px solid var(--border)' }}>
                      <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input
                          value={step.title}
                          onChange={e => updateStep(idx, { title: e.target.value })}
                          placeholder="Step title"
                          style={{ width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                        />
                        <select
                          value={step.type}
                          onChange={e => {
                            const type = e.target.value as TrainStepType
                            updateStep(idx, { type, content: defaultStepContent(type) })
                          }}
                          style={{ width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                        >
                          {STEP_TYPES.map(t => (
                            <option key={t.type} value={t.type}>{t.label}</option>
                          ))}
                        </select>
                        <StepContentFields
                          type={step.type}
                          content={step.content}
                          onChange={content => updateStep(idx, { content })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showAddStep && (
              <div style={{ marginTop: 16, background: 'var(--page-bg)', border: '0.5px solid #1052A3', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12 }}>New step</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input
                    value={newStep.title}
                    onChange={e => setNewStep(p => ({ ...p, title: e.target.value }))}
                    placeholder="Step title"
                    style={{ flex: 2, minWidth: 160, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <select
                    value={newStep.type}
                    onChange={e => {
                      const type = e.target.value as TrainStepType
                      setNewStep(p => ({ ...p, type, content: defaultStepContent(type) }))
                    }}
                    style={{ flex: 1, minWidth: 120, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  >
                    {STEP_TYPES.map(t => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newStep.duration_minutes}
                    onChange={e => setNewStep(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                    placeholder="Min"
                    min={1}
                    style={{ width: 80, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Module content
                  </p>
                  <StepContentFields
                    type={newStep.type}
                    content={newStep.content}
                    onChange={content => setNewStep(p => ({ ...p, content }))}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mid-grey)', marginBottom: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={newStep.is_mandatory} onChange={e => setNewStep(p => ({ ...p, is_mandatory: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  Required to complete path
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button accent="#1052A3" size="sm" onClick={addStep}>Add step</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddStep(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </CreationGate>
  )
}

export default function TrainBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mid-grey)' }}>Loading path builder...</div>}>
      <TrainBuilderInner />
    </Suspense>
  )
}
