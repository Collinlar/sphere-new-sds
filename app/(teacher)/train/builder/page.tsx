'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PathStep } from '@/lib/types'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

const STEP_TYPES = [
  { type: 'video', label: 'Video', icon: '▶' },
  { type: 'reading', label: 'Reading', icon: '📄' },
  { type: 'quiz', label: 'Quiz', icon: '✓' },
  { type: 'sign_off', label: 'Sign-off', icon: '✍' },
  { type: 'assessment', label: 'Assessment', icon: '📊' },
] as const

type StepType = 'video' | 'reading' | 'quiz' | 'sign_off' | 'assessment'

const CATEGORIES = ['Compliance', 'Onboarding', 'Skills', 'Leadership']

const DEPARTMENTS = ['All staff', 'Sales', 'Operations', 'Finance', 'Customer Support', 'HR', 'Engineering']

interface NewStep {
  title: string
  type: StepType
  duration_minutes: number
  is_mandatory: boolean
}

const DEFAULT_STEP: NewStep = { title: '', type: 'video', duration_minutes: 10, is_mandatory: true }

export default function TrainBuilderPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Compliance')
  const [isMandatory, setIsMandatory] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [steps, setSteps] = useState<(PathStep)[]>([])
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStep, setNewStep] = useState<NewStep>(DEFAULT_STEP)
  const [assignedDepts, setAssignedDepts] = useState<string[]>(['All staff'])
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const toggleDept = (dept: string) => {
    setAssignedDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  const addStep = useCallback(() => {
    if (!newStep.title.trim()) return
    setSteps(prev => [
      ...prev,
      {
        id: `st-${Date.now()}`,
        title: newStep.title,
        type: newStep.type,
        content: {},
        duration_minutes: newStep.duration_minutes,
        is_mandatory: newStep.is_mandatory,
      },
    ])
    setNewStep(DEFAULT_STEP)
    setShowAddStep(false)
  }, [newStep])

  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx))

  async function savePath(publish: boolean) {
    if (!title.trim()) { setError('Give your training path a title first.'); return }
    const setter = publish ? setPublishing : setSaving
    setter(true)
    setError('')

    const payload = {
      institution_id: getCurrentUser().institution_id,
      creator_id: getCurrentUser().id,
      title,
      description,
      category,
      steps,
      is_mandatory: isMandatory,
      due_date: dueDate || null,
      assigned_departments: assignedDepts,
      updated_at: new Date().toISOString(),
    }

    const { error: dbError } = await supabase.from('learning_paths').insert([payload])
    setter(false)
    if (dbError) {
      setError('Could not save right now. Check your connection and try again.')
    } else {
      router.push('/train')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="train"
        title="Path builder"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => savePath(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Save draft'}
            </Button>
            <Button accent="#185FA5" size="sm" onClick={() => savePath(true)} disabled={publishing}>
              {publishing ? 'Publishing...' : 'Publish path'}
            </Button>
          </div>
        }
      />

      {error && (
        <div style={{ background: '#FDECEA', color: '#7A1A10', fontSize: 13, padding: '10px 32px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, padding: '28px 32px', maxWidth: 1100, alignItems: 'flex-start' }}>
        {/* Left: path metadata */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '20px 20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Path details</div>

            {[
              { label: 'Path title', value: title, set: setTitle, placeholder: 'What is this training called?' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--near-black)' }}
                />
              </div>
            ))}

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
                    onClick={() => setCategory(c)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: category === c ? 600 : 400,
                      color: category === c ? '#fff' : 'var(--mid-grey)',
                      background: category === c ? '#185FA5' : 'var(--bg2)',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
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
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={e => setIsMandatory(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Mandatory for all assigned employees
            </label>
          </div>

          {/* Assign to team */}
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 14 }}>Assign to team</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEPARTMENTS.map(dept => (
                <label key={dept} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--near-black)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={assignedDepts.includes(dept)}
                    onChange={() => toggleDept(dept)}
                    style={{ width: 16, height: 16, accentColor: '#185FA5' }}
                  />
                  {dept}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: steps */}
        <div style={{ flex: 1 }}>
          <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>
                Steps <span style={{ fontWeight: 400, color: 'var(--mid-grey)', fontSize: 13 }}>({steps.length})</span>
              </div>
              <Button accent="#185FA5" size="sm" onClick={() => setShowAddStep(true)}>+ Add step</Button>
            </div>

            {steps.length === 0 && !showAddStep && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                No steps yet. Add a video, reading, quiz, or sign-off to start building.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => (
                <div key={step.id} style={{
                  background: 'var(--page-bg)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 16 }}>
                    {STEP_TYPES.find(t => t.type === step.type)?.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{step.duration_minutes} min</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#0B2E52', background: '#E6F1FB', padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>
                    {step.type.replace('_', ' ')}
                  </span>
                  {step.is_mandatory && (
                    <span style={{ fontSize: 11, color: '#7A1A10', background: '#FDECEA', padding: '2px 8px', borderRadius: 4 }}>Required</span>
                  )}
                  <button onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05C4B', fontSize: 16, padding: 4 }}>×</button>
                </div>
              ))}
            </div>

            {showAddStep && (
              <div style={{ marginTop: 16, background: 'var(--page-bg)', border: '0.5px solid #185FA5', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12 }}>New step</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input
                    value={newStep.title}
                    onChange={e => setNewStep(p => ({ ...p, title: e.target.value }))}
                    placeholder="Step title"
                    style={{ flex: 2, minWidth: 160, background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <select
                    value={newStep.type}
                    onChange={e => setNewStep(p => ({ ...p, type: e.target.value as StepType }))}
                    style={{ flex: 1, minWidth: 120, background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  >
                    {STEP_TYPES.map(t => (
                      <option key={t.type} value={t.type}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newStep.duration_minutes}
                    onChange={e => setNewStep(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                    placeholder="Min"
                    min={1}
                    style={{ width: 80, background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mid-grey)', marginBottom: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newStep.is_mandatory}
                    onChange={e => setNewStep(p => ({ ...p, is_mandatory: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  Required to complete path
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button accent="#185FA5" size="sm" onClick={addStep}>Add step</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddStep(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
