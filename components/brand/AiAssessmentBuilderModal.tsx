'use client'

import { useEffect, useState } from 'react'
import {
  ASSESSMENT_SUBJECTS,
  DIFFICULTY_OPTIONS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  MIX_PRESETS,
  buildAssessmentAiPreview,
  defaultAssessmentAiConfig,
  mixForPreset,
  mixTotal,
  validateAssessmentAiConfig,
  type AssessmentAiConfig,
  type MixPreset,
  type QuestionTypeKey,
  type ReplaceMode,
} from '@/lib/ai-assessment-generation'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (config: AssessmentAiConfig) => void
  loading?: boolean
  loadingMessage?: string
  subject?: string
  gradeLevel?: string
  gradeLevels: string[]
  hasExistingQuestions?: boolean
}

const TYPE_LABELS: Record<QuestionTypeKey, string> = {
  mcq: 'Multiple choice',
  true_false: 'True / false',
  short: 'Short answer',
  essay: 'Essay',
}

export default function AiAssessmentBuilderModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  loadingMessage = '',
  subject = '',
  gradeLevel = '',
  gradeLevels,
  hasExistingQuestions = false,
}: Props) {
  const [config, setConfig] = useState<AssessmentAiConfig>(() =>
    defaultAssessmentAiConfig(subject, gradeLevel)
  )
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setConfig(defaultAssessmentAiConfig(subject, gradeLevel))
    setError('')
  }, [open, subject, gradeLevel])

  if (!open) return null

  const preview = buildAssessmentAiPreview(config)
  const total = mixTotal(config.typeMix)

  function updateConfig(patch: Partial<AssessmentAiConfig>) {
    setConfig(prev => ({ ...prev, ...patch }))
    setError('')
  }

  function setPreset(preset: MixPreset) {
    setConfig(prev => ({
      ...prev,
      mixPreset: preset,
      typeMix: preset === 'custom' ? prev.typeMix : mixForPreset(preset, prev.totalCount),
    }))
    setError('')
  }

  function setTotalCount(count: number) {
    const totalCount = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, count))
    setConfig(prev => ({
      ...prev,
      totalCount,
      typeMix: prev.mixPreset === 'custom' ? prev.typeMix : mixForPreset(prev.mixPreset, totalCount),
    }))
    setError('')
  }

  function setMixField(key: QuestionTypeKey, value: number) {
    const safe = Math.max(0, Math.min(MAX_QUESTIONS, value))
    setConfig(prev => ({
      ...prev,
      mixPreset: 'custom',
      typeMix: { ...prev.typeMix, [key]: safe },
    }))
    setError('')
  }

  function handleSubmit() {
    const validation = validateAssessmentAiConfig(config)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    onSubmit(config)
  }

  const inputStyle: React.CSSProperties = {
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
            Draft questions with AI
          </p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
            Set the topic, count, and question mix. Review the preview before drafting.
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
              background: '#FEF0DC', borderRadius: 8, padding: '12px 14px', marginBottom: 14,
            }}>
              <p style={{ fontSize: 13, color: '#7A4A00', fontWeight: 500 }}>
                {loadingMessage || 'Drafting your questions...'}
              </p>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
            Topic or syllabus area
          </label>
          <input
            value={config.topic}
            onChange={e => updateConfig({ topic: e.target.value })}
            placeholder="e.g. Introduction to artificial intelligence"
            disabled={loading}
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>
            Syllabus detail (optional)
          </label>
          <textarea
            value={config.detail}
            onChange={e => updateConfig({ detail: e.target.value })}
            placeholder="Chapters, learning outcomes, or topics to include or skip"
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
                {ASSESSMENT_SUBJECTS.map(s => (
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
            Total questions: {config.totalCount}
          </label>
          <input
            type="range"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            value={config.totalCount}
            onChange={e => setTotalCount(Number(e.target.value))}
            disabled={loading || config.mixPreset === 'custom'}
            style={{ width: '100%', accentColor: '#C23B2A', marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Question mix
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {MIX_PRESETS.map(preset => {
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
                    border: active ? '1.5px solid #C23B2A' : '1px solid var(--border)',
                    background: active ? '#FDECEA' : 'var(--white)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: active ? '#C23B2A' : 'var(--near-black)' }}>
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
              {(Object.keys(TYPE_LABELS) as QuestionTypeKey[]).map(key => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 4 }}>
                    {TYPE_LABELS[key]}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={MAX_QUESTIONS}
                    value={config.typeMix[key]}
                    onChange={e => setMixField(key, Number(e.target.value))}
                    disabled={loading}
                    style={{ ...inputStyle, height: 40 }}
                  />
                </div>
              ))}
              <p style={{ gridColumn: '1 / -1', fontSize: 12, color: total > MAX_QUESTIONS ? '#C23B2A' : 'var(--mid-grey)' }}>
                Custom total: {total} question{total === 1 ? '' : 's'}
              </p>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Difficulty
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {DIFFICULTY_OPTIONS.map(opt => {
              const active = config.difficulty === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateConfig({ difficulty: opt.id })}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 8,
                    border: active ? '1.5px solid #C23B2A' : '1px solid var(--border)',
                    background: active ? '#FDECEA' : 'var(--white)',
                    color: active ? '#C23B2A' : 'var(--mid-grey)',
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

          {hasExistingQuestions && (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>
                Existing questions
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
                        border: active ? '1.5px solid #C23B2A' : '1px solid var(--border)',
                        background: active ? '#FDECEA' : 'var(--white)',
                        color: active ? '#C23B2A' : 'var(--mid-grey)',
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
            borderLeft: '3px solid #C23B2A',
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
              background: loading ? 'var(--bg2)' : '#C23B2A',
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
            {loading ? 'Drafting...' : 'Draft my questions'}
          </button>
        </div>
      </div>
    </div>
  )
}
