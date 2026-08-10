'use client'

import { useState } from 'react'
import type { QuizQuestion } from '@/lib/types'
import NumericAnswer from './NumericAnswer'
import OrderingAnswer from './OrderingAnswer'

const ANSWER_COLORS: Record<string, string> = {
  A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010',
}

/**
 * The single place that decides how a question is answered.
 *
 * This exists because the type branch used to live only in the solo play
 * path, so team and co-op rendered every question as multiple choice, and
 * short_answer and multi_select were wrong even in solo. One surface, used
 * by all three modes, means a new question type is playable everywhere the
 * moment it is added here.
 *
 * visibleLabels is how split-information co-op shows a player only the
 * options dealt to them. Types with nothing to split (a typed number, a
 * sequence, free text) ignore it and show in full.
 */
export default function AnswerSurface({
  question,
  disabled,
  selected,
  visibleLabels,
  onAnswer,
}: {
  question: QuizQuestion
  disabled: boolean
  selected: string | null
  /** Co-op: restrict option-based questions to these labels. */
  visibleLabels?: string[]
  /** Value is a label, a comma-joined list, or typed text. */
  onAnswer: (value: string) => void
}) {
  const [multi, setMulti] = useState<string[]>([])
  const [text, setText] = useState('')

  if (question.type === 'numeric') {
    return <NumericAnswer unit={question.unit} disabled={disabled} onSubmit={onAnswer} />
  }

  if (question.type === 'ordering') {
    return (
      <OrderingAnswer
        options={question.options}
        disabled={disabled}
        onSubmit={labels => onAnswer(labels.join(','))}
      />
    )
  }

  if (question.type === 'short_answer') {
    const ready = text.trim().length > 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && ready && !disabled) onAnswer(text) }}
          placeholder="Type your answer"
          disabled={disabled}
          autoFocus
          style={{
            width: '100%', height: 64, borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 20, fontWeight: 600, textAlign: 'center',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => ready && onAnswer(text)}
          disabled={!ready || disabled}
          style={{
            height: 56, borderRadius: 12, border: 'none',
            background: ready && !disabled ? 'var(--amber, #D97010)' : 'rgba(255,255,255,0.12)',
            color: ready && !disabled ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 16, fontWeight: 700,
            cursor: ready && !disabled ? 'pointer' : 'default', fontFamily: 'inherit',
          }}
        >
          Send my answer
        </button>
      </div>
    )
  }

  const options = visibleLabels?.length
    ? question.options.filter(o => visibleLabels.includes(o.label))
    : question.options

  // Multi-select needs several taps before it can be sent, so it collects
  // first and submits once. Tapping one option used to send immediately,
  // which could never match a multi-answer key.
  if (question.type === 'multi_select') {
    const toggle = (label: string) =>
      setMulti(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Pick every answer that is right.
        </p>
        {options.map(opt => {
          const on = multi.includes(opt.label)
          return (
            <button
              key={opt.label}
              onClick={() => !disabled && toggle(opt.label)}
              disabled={disabled}
              style={{
                width: '100%', border: on ? '2px solid #fff' : '2px solid transparent',
                background: on ? ANSWER_COLORS[opt.label] ?? '#2E2886' : `${ANSWER_COLORS[opt.label] ?? '#2E2886'}99`,
                borderRadius: 12, padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: disabled ? 'default' : 'pointer', minHeight: 60, textAlign: 'left',
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.25)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{on ? '✓' : opt.label}</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
            </button>
          )
        })}
        <button
          onClick={() => multi.length > 0 && onAnswer([...multi].sort().join(','))}
          disabled={multi.length === 0 || disabled}
          style={{
            height: 56, borderRadius: 12, border: 'none',
            background: multi.length > 0 && !disabled ? 'var(--amber, #D97010)' : 'rgba(255,255,255,0.12)',
            color: multi.length > 0 && !disabled ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 16, fontWeight: 700,
            cursor: multi.length > 0 && !disabled ? 'pointer' : 'default', fontFamily: 'inherit',
          }}
        >
          Send {multi.length > 0 ? `${multi.length} answer${multi.length === 1 ? '' : 's'}` : 'my answers'}
        </button>
      </div>
    )
  }

  // mcq, true_false, poll
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={() => onAnswer(opt.label)}
          disabled={disabled}
          style={{
            width: '100%',
            background: selected === opt.label
              ? ANSWER_COLORS[opt.label] ?? '#2E2886'
              : `${ANSWER_COLORS[opt.label] ?? '#2E2886'}CC`,
            border: 'none', borderRadius: 12, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: disabled ? 'default' : 'pointer',
            opacity: selected && selected !== opt.label ? 0.5 : 1,
            minHeight: 64, textAlign: 'left',
          }}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.25)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{opt.label}</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
        </button>
      ))}
    </div>
  )
}
