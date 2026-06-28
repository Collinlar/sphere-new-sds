'use client'

import type { PathStep } from '@/lib/types'

type StepType = PathStep['type']

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--white)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  color: 'var(--near-black)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--mid-grey)',
  display: 'block',
  marginBottom: 6,
}

interface StepContentFieldsProps {
  type: StepType
  content: Record<string, unknown>
  onChange: (content: Record<string, unknown>) => void
}

export default function StepContentFields({ type, content, onChange }: StepContentFieldsProps) {
  if (type === 'video') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>YouTube video ID or URL</label>
          <input
            value={(content.youtube_id as string) ?? ''}
            onChange={e => onChange({ ...content, youtube_id: e.target.value.trim() })}
            placeholder="e.g. dQw4w9WgXcQ or paste a YouTube link"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Intro note (optional)</label>
          <textarea
            value={(content.body as string) ?? ''}
            onChange={e => onChange({ ...content, body: e.target.value })}
            placeholder="What should employees watch for?"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    )
  }

  if (type === 'reading') {
    const quickCheck = (content.quick_check as { text?: string; options?: string[]; correct?: number }) ?? {}
    const options = quickCheck.options ?? ['', '', '']
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Reading content</label>
          <textarea
            value={(content.body as string) ?? ''}
            onChange={e => onChange({ ...content, body: e.target.value })}
            placeholder="Paste or write the reading material employees must review."
            rows={6}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Key principle</label>
          <input
            value={(content.key_principle as string) ?? ''}
            onChange={e => onChange({ ...content, key_principle: e.target.value })}
            placeholder="One sentence summary employees should remember"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Quick check question</label>
          <input
            value={quickCheck.text ?? ''}
            onChange={e => onChange({ ...content, quick_check: { ...quickCheck, text: e.target.value, options, correct: quickCheck.correct ?? 0 } })}
            placeholder="Optional question to confirm they read it"
            style={inputStyle}
          />
        </div>
        {quickCheck.text && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map((opt, oi) => (
              <input
                key={oi}
                value={opt}
                onChange={e => {
                  const next = [...options]
                  next[oi] = e.target.value
                  onChange({ ...content, quick_check: { ...quickCheck, options: next, correct: quickCheck.correct ?? 0 } })
                }}
                placeholder={`Option ${oi + 1}`}
                style={inputStyle}
              />
            ))}
            <select
              value={quickCheck.correct ?? 0}
              onChange={e => onChange({ ...content, quick_check: { ...quickCheck, options, correct: Number(e.target.value) } })}
              style={inputStyle}
            >
              {options.map((_, oi) => (
                <option key={oi} value={oi}>Correct answer: option {oi + 1}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  if (type === 'quiz') {
    const questions = (content.questions as { text: string; options: string[] }[]) ?? [{ text: '', options: ['', ''] }]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {questions.map((q, qi) => (
          <div key={qi} style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)' }}>Question {qi + 1}</span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...content, questions: questions.filter((_, i) => i !== qi) })}
                  style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={q.text}
              onChange={e => {
                const next = [...questions]
                next[qi] = { ...q, text: e.target.value }
                onChange({ ...content, questions: next })
              }}
              placeholder="Question text"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {q.options.map((opt, oi) => (
              <input
                key={oi}
                value={opt}
                onChange={e => {
                  const next = [...questions]
                  const opts = [...q.options]
                  opts[oi] = e.target.value
                  next[qi] = { ...q, options: opts }
                  onChange({ ...content, questions: next })
                }}
                placeholder={`Answer option ${oi + 1}`}
                style={{ ...inputStyle, marginBottom: 6 }}
              />
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...content, questions: [...questions, { text: '', options: ['', ''] }] })}
          style={{ background: 'none', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#1052A3' }}
        >
          + Add question
        </button>
      </div>
    )
  }

  if (type === 'sign_off') {
    return (
      <div>
        <label style={labelStyle}>Policy or acknowledgement text</label>
        <textarea
          value={(content.policy_text as string) ?? ''}
          onChange={e => onChange({ ...content, policy_text: e.target.value })}
          placeholder="What the employee confirms by signing off"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    )
  }

  if (type === 'assessment') {
    return (
      <div>
        <label style={labelStyle}>Assessment prompt</label>
        <textarea
          value={(content.prompt as string) ?? ''}
          onChange={e => onChange({ ...content, prompt: e.target.value })}
          placeholder="What should the employee write or demonstrate?"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    )
  }

  return null
}
