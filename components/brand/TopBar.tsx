'use client'

interface TopBarProps {
  mode: 'engage' | 'assess' | 'learn' | 'train' | 'platform' | 'students'
  title?: string
  right?: React.ReactNode
}

const MODE_META = {
  engage: { label: 'Engage', accent: '#EF9F27', bg: '#FEF3DC', text: '#7A4A00' },
  assess: { label: 'Assess', accent: '#E05C4B', bg: '#FDECEA', text: '#7A1A10' },
  learn: { label: 'Learn', accent: '#2BA888', bg: '#E1F5EE', text: '#0A4A38' },
  train: { label: 'Train', accent: '#185FA5', bg: '#E6F1FB', text: '#0B2E52' },
  platform: { label: 'Platform', accent: '#36318F', bg: '#EEEDF8', text: '#1C196B' },
  students: { label: 'Students', accent: '#36318F', bg: '#EEEDF8', text: '#1C196B' },
}

export default function TopBar({ mode, title, right }: TopBarProps) {
  const meta = MODE_META[mode]
  return (
    <div style={{
      background: 'var(--white)',
      borderBottom: '0.5px solid var(--border)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {title && (
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{title}</span>
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
