'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import {
  COURSE_DEPTH_OPTIONS,
  COURSE_MIX_PRESETS,
  COURSE_SUBJECTS,
  MAX_MODULES,
  MIN_MODULES,
  buildCourseAiPreview,
  courseMixForPreset,
  courseMixTotal,
  defaultCourseAiConfig,
  validateCourseAiConfig,
  type CourseAiConfig,
  type CourseMixPreset,
  type CourseModuleType,
  type ReplaceMode,
} from '@/lib/ai-course-generation'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (config: CourseAiConfig) => void | Promise<void>
  loading?: boolean
  loadingMessage?: string
  subject?: string
  gradeLevel?: string
  gradeLevels: string[]
  hasExistingModules?: boolean
}

const TYPE_LABELS: Record<CourseModuleType, string> = {
  reading: 'Reading',
  video: 'Video',
  quiz: 'Quiz',
  assignment: 'Assignment',
  flashcards: 'Flashcards',
}

export default function AiCourseBuilderModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  loadingMessage = '',
  subject = '',
  gradeLevel = '',
  gradeLevels,
  hasExistingModules = false,
}: Props) {
  const [config, setConfig] = useState<CourseAiConfig>(() =>
    defaultCourseAiConfig(subject, gradeLevel)
  )
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setConfig(defaultCourseAiConfig(subject, gradeLevel))
    setError('')
  }, [open, subject, gradeLevel])

  if (!open) return null

  const preview = buildCourseAiPreview(config)
  const total = courseMixTotal(config.typeMix)

  function updateConfig(patch: Partial<CourseAiConfig>) {
    setConfig(prev => ({ ...prev, ...patch }))
    setError('')
  }

  function setPreset(preset: CourseMixPreset) {
    setConfig(prev => ({
      ...prev,
      mixPreset: preset,
      typeMix: preset === 'custom' ? prev.typeMix : courseMixForPreset(preset, prev.totalCount),
    }))
    setError('')
  }

  function setTotalCount(count: number) {
    const totalCount = Math.max(MIN_MODULES, Math.min(MAX_MODULES, count))
    setConfig(prev => ({
      ...prev,
      totalCount,
      typeMix: prev.mixPreset === 'custom' ? prev.typeMix : courseMixForPreset(prev.mixPreset, totalCount),
    }))
    setError('')
  }

  function setMixField(key: CourseModuleType, value: number) {
    const safe = Math.max(0, Math.min(MAX_MODULES, value))
    setConfig(prev => ({
      ...prev,
      mixPreset: 'custom',
      typeMix: { ...prev.typeMix, [key]: safe },
    }))
    setError('')
  }

  async function handleSubmit() {
    const validation = validateCourseAiConfig(config)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    try {
      await onSubmit(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft modules. Try again.')
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg2)',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--near-black)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,16,33,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 20,
      }}
      onClick={loading ? undefined : onClose}
    >
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(12,16,33,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '0.5px solid var(--bg2)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
            Draft course with AI
          </p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
            Set the topic, module count, and mix. Review the preview before drafting.
          </p>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {error && (
            <p style={{
              fontSize: 13, color: '#C23B2A', background: '#FDECEA', borderRadius: 8,
              padding: '10px 12px', marginBottom: 14,
            }}>
              {error}
            </p>
          )}

          {loading && (
            <div style={{
              background: '#E1F5EE', borderRadius: 8, padding: '12px 14px', marginBottom: 14,
            }}>
              <p style={{ fontSize: 13, color: '#085041', fontWeight: 500 }}>
                {loadingMessage || 'Drafting your course modules...'}
              </p>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
            Topic or learning outcome
          </label>
          <input
            value={config.topic}
            onChange={e => updateConfig({ topic: e.target.value })}
            placeholder="e.g. Cell division for JHS Science"
            disabled={loading}
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
            Syllabus detail (optional)
          </label>
          <textarea
            value={config.detail}
            onChange={e => updateConfig({ detail: e.target.value })}
            placeholder="Chapters, outcomes, or topics to include or skip"
            disabled={loading}
            rows={3}
            style={{
              ...inputStyle,
              height: 'auto',
              padding: '10px 12px',
              resize: 'vertical',
              marginBottom: 14,
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
                Subject
              </label>
              <select
                value={config.subject}
                onChange={e => updateConfig({ subject: e.target.value })}
                disabled={loading}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Pick a subject</option>
                {COURSE_SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
                Level
              </label>
              <select
                value={config.gradeLevel}
                onChange={e => updateConfig({ gradeLevel: e.target.value })}
                disabled={loading}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Pick a level</option>
                {gradeLevels.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Total modules: {config.totalCount}
          </label>
          <input
            type="range"
            min={MIN_MODULES}
            max={MAX_MODULES}
            value={config.totalCount}
            onChange={e => setTotalCount(Number(e.target.value))}
            disabled={loading || config.mixPreset === 'custom'}
            style={{ width: '100%', accentColor: '#1A8966', marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Module mix
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {COURSE_MIX_PRESETS.map(preset => {
              const active = config.mixPreset === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPreset(preset.id)}
                  disabled={loading}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: active ? '1.5px solid #1A8966' : '1px solid var(--border)',
                    background: active ? '#E1F5EE' : 'var(--white)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: active ? '#085041' : 'var(--near-black)' }}>
                    {preset.label}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>{preset.desc}</p>
                </button>
              )
            })}
          </div>

          {config.mixPreset === 'custom' && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              marginBottom: 14, padding: '12px', background: 'var(--bg2)', borderRadius: 8,
            }}>
              {(Object.keys(TYPE_LABELS) as CourseModuleType[]).map(key => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 4 }}>
                    {TYPE_LABELS[key]}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={MAX_MODULES}
                    value={config.typeMix[key]}
                    onChange={e => setMixField(key, Number(e.target.value))}
                    disabled={loading}
                    style={{ ...inputStyle, height: 40 }}
                  />
                </div>
              ))}
              <p style={{ gridColumn: '1 / -1', fontSize: 12, color: total > MAX_MODULES ? '#C23B2A' : 'var(--mid-grey)' }}>
                Custom total: {total} module{total === 1 ? '' : 's'}
              </p>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Depth
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {COURSE_DEPTH_OPTIONS.map(opt => {
              const active = config.depth === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateConfig({ depth: opt.id })}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 8,
                    border: active ? '1.5px solid #1A8966' : '1px solid var(--border)',
                    background: active ? '#E1F5EE' : 'var(--white)',
                    color: active ? '#085041' : 'var(--mid-grey)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {hasExistingModules && (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
                Existing modules
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {([
                  { id: 'replace' as ReplaceMode, label: 'Replace all' },
                  { id: 'append' as ReplaceMode, label: 'Add to end' },
                ]).map(opt => {
                  const active = config.replaceMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateConfig({ replaceMode: opt.id })}
                      disabled={loading}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 8,
                        border: active ? '1.5px solid #1A8966' : '1px solid var(--border)',
                        background: active ? '#E1F5EE' : 'var(--white)',
                        color: active ? '#085041' : 'var(--mid-grey)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div style={{
            background: 'var(--bg2)',
            borderRadius: 10,
            padding: '14px 16px',
            borderLeft: '3px solid #1A8966',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mid-grey)', marginBottom: 6 }}>
              Preview
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
              {preview.headline}
            </p>
            {preview.lines.map(line => (
              <p key={line} style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.55, marginBottom: 4 }}>
                {line}
              </p>
            ))}
          </div>
        </div>

        <div style={{
          padding: '14px 22px 20px',
          borderTop: '0.5px solid var(--bg2)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              color: 'var(--mid-grey)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              padding: '10px 14px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: loading ? 'var(--bg2)' : '#1A8966',
              color: loading ? 'var(--mid-grey)' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Drafting...' : 'Draft my modules'}
          </button>
        </div>
      </div>
    </div>
  )
}
