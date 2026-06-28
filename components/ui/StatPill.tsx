import { CSSProperties } from 'react'

interface StatPillProps {
  value: string | number
  label: string
  accent?: string
  style?: CSSProperties
}

export default function StatPill({ value, label, accent, style }: StatPillProps) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--white)',
        borderRadius: 10,
        padding: '14px 12px',
        boxShadow: 'var(--shadow-soft)',
        textAlign: 'center',
        ...style,
      }}
    >
      <p style={{ fontSize: 24, fontWeight: 700, color: accent ?? 'var(--near-black)' }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{label}</p>
    </div>
  )
}
