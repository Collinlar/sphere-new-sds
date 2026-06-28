'use client'

interface Tab {
  key: string
  label: string
  count?: number
  accent?: string
}

interface SegmentTabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export default function SegmentTabs({ tabs, active, onChange }: SegmentTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {tabs.map(tab => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              height: 30,
              padding: '0 12px',
              background: isActive ? 'var(--near-black)' : 'var(--bg2)',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#fff' : 'var(--mid-grey)',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
