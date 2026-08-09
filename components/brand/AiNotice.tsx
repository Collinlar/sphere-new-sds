'use client'

/**
 * Non-blocking notice after an AI draft: a short set, or items needing a
 * human check. Renders nothing when there is nothing to say.
 */
export default function AiNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div style={{
      background: 'var(--amber-light)',
      border: '0.5px solid #E8A020',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 18,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <p style={{ fontSize: 13, color: '#9A5800', lineHeight: 1.55 }}>{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: '#9A5800', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
