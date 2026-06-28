interface ProgressTrackProps {
  value: number
  max?: number
  color?: string
  height?: number
}

export default function ProgressTrack({ value, max = 100, color = 'var(--teal)', height = 6 }: ProgressTrackProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ height, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}
