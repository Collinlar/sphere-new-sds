'use client'

interface TopBarProps {
  mode: 'engage' | 'assess' | 'learn' | 'train' | 'platform' | 'students'
  title?: string
  right?: React.ReactNode
}

const MODE_META = {
  engage: { label: 'Engage', accent: '#D97010', bg: '#FEF0DC', text: '#D97010' },
  assess: { label: 'Assess', accent: '#C23B2A', bg: '#FDECEA', text: '#C23B2A' },
  learn: { label: 'Learn', accent: '#1A8966', bg: '#DDFAF0', text: '#1A8966' },
  train: { label: 'Train', accent: '#1052A3', bg: '#E3EDFB', text: '#1052A3' },
  platform: { label: 'Platform', accent: '#2E2886', bg: '#EEEDF8', text: '#2E2886' },
  students: { label: 'Students', accent: '#2E2886', bg: '#EEEDF8', text: '#2E2886' },
}

export default function TopBar({ mode, title, right }: TopBarProps) {
  const meta = MODE_META[mode]
  return (
    <div style={{
      background: 'var(--white)',
      borderBottom: '0.5px solid var(--s2)',
      padding: '0 28px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {title && (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>{title}</span>
          </>
        )}
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: meta.text,
          background: meta.bg,
          padding: '3px 8px',
          borderRadius: 4,
        }}>
          {meta.label}
        </span>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>}
    </div>
  )
}
