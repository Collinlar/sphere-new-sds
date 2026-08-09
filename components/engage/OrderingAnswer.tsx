'use client'

import { useState } from 'react'

/**
 * Ordering. The learner arranges items into a sequence.
 *
 * Tap-to-move rather than drag-and-drop: on a small touch screen over a slow
 * connection, dragging is fiddly and easy to get wrong, and it fails outright
 * for anyone using assistive input. Tapping up and down always works.
 */
export default function OrderingAnswer({
  options,
  disabled,
  onSubmit,
}: {
  options: { label: string; text: string }[]
  disabled: boolean
  onSubmit: (orderedLabels: string[]) => void
}) {
  // Always shuffle before showing. A hand-authored question stores its steps
  // in the correct order, so presenting them as stored would hand over the
  // answer. Shuffling here is safe for AI-drafted questions too, whose
  // options are already scrambled.
  const [order, setOrder] = useState<string[]>(() => {
    const labels = options.map(o => o.label)
    for (let i = labels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[labels[i], labels[j]] = [labels[j], labels[i]]
    }
    // A shuffle that happens to land in the right order would show the answer.
    if (labels.length > 1 && labels.every((l, i) => l === options[i].label)) {
      ;[labels[0], labels[1]] = [labels[1], labels[0]]
    }
    return labels
  })

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    setOrder(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const textFor = (label: string) => options.find(o => o.label === label)?.text ?? label

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        Put these in the right order, first at the top.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {order.map((label, i) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '10px 10px 10px 14px',
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.16)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 15, color: '#fff', lineHeight: 1.35 }}>{textFor(label)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0 || disabled}
                aria-label="Move up"
                style={{
                  width: 44, height: 26, borderRadius: 6, border: 'none',
                  background: i === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)',
                  color: i === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
                  fontSize: 12, cursor: i === 0 || disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >▲</button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1 || disabled}
                aria-label="Move down"
                style={{
                  width: 44, height: 26, borderRadius: 6, border: 'none',
                  background: i === order.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)',
                  color: i === order.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff',
                  fontSize: 12, cursor: i === order.length - 1 || disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >▼</button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(order)}
        disabled={disabled}
        style={{
          height: 56, borderRadius: 12, border: 'none',
          background: disabled ? 'rgba(255,255,255,0.12)' : 'var(--amber, #D97010)',
          color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
          fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        }}
      >
        Lock in this order
      </button>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        Every item in the right place scores.
      </p>
    </div>
  )
}
