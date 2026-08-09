'use client'

import { useState } from 'react'

/**
 * Numeric estimate. The learner types a number rather than picking from a
 * list, which is real recall instead of recognition, and it removes the
 * "guess between four" problem entirely for Maths and Science.
 */
export default function NumericAnswer({
  unit,
  disabled,
  onSubmit,
}: {
  unit?: string
  disabled: boolean
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const ready = value.trim() !== '' && Number.isFinite(Number(value))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^\d.\-]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter' && ready && !disabled) onSubmit(value) }}
          inputMode="decimal"
          placeholder="Your answer"
          disabled={disabled}
          autoFocus
          style={{
            flex: 1, height: 68, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            fontSize: 26, fontWeight: 700, textAlign: 'center',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        {unit && (
          <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>{unit}</span>
        )}
      </div>
      <button
        onClick={() => ready && onSubmit(value)}
        disabled={!ready || disabled}
        style={{
          height: 56, borderRadius: 12, border: 'none',
          background: ready && !disabled ? 'var(--amber, #D97010)' : 'rgba(255,255,255,0.12)',
          color: ready && !disabled ? '#fff' : 'rgba(255,255,255,0.4)',
          fontSize: 16, fontWeight: 700,
          cursor: ready && !disabled ? 'pointer' : 'default', fontFamily: 'inherit',
        }}
      >
        Lock in my answer
      </button>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        Closer answers score more.
      </p>
    </div>
  )
}
