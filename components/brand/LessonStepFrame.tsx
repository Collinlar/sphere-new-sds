'use client'

import type { ReactNode } from 'react'

/** Focused lesson chrome matching the Study step card: subject, progress, white card, vertical CTAs. */
export function LessonStepFrame({
  subject,
  stepIndex,
  stepCount,
  title,
  meta,
  media,
  children,
  remember,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel = 'Back to outline',
  onSecondary,
  tertiaryLabel,
  onTertiary,
}: {
  subject: string
  stepIndex: number
  stepCount: number
  title: string
  meta: string
  media?: ReactNode
  children: ReactNode
  remember?: string | null
  primaryLabel?: string
  onPrimary?: () => void
  primaryDisabled?: boolean
  secondaryLabel?: string
  onSecondary: () => void
  tertiaryLabel?: string
  onTertiary?: () => void
}) {
  const progressPct = stepCount > 0 ? ((stepIndex + 1) / stepCount) * 100 : 0

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '20px 16px 40px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#1A8966',
        }}>
          {subject}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)' }}>
          Step {stepIndex + 1} of {stepCount}
        </span>
      </div>

      <div style={{ height: 6, background: '#E8E4DC', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          width: `${progressPct}%`, height: '100%', background: '#1A8966', borderRadius: 999,
          transition: 'width 0.25s ease',
        }} />
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 8px 28px rgba(17, 24, 39, 0.06)',
        padding: '28px 22px 24px',
        marginBottom: 16,
      }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1.2,
          margin: '0 0 8px', letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.4 }}>
          {meta}
        </p>

        {media && (
          <div style={{ marginBottom: 20 }}>
            {media}
          </div>
        )}

        <div style={{ fontSize: 16, color: '#111827', lineHeight: 1.7 }}>
          {children}
        </div>

        {remember && (
          <div style={{
            marginTop: 22,
            background: '#E1F5EE',
            borderRadius: 12,
            padding: '14px 14px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: '#1A8966', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, fontStyle: 'italic',
            }}>
              i
            </span>
            <p style={{ fontSize: 14, color: '#085041', lineHeight: 1.55, margin: 0 }}>
              <strong style={{ fontWeight: 700 }}>Remember:</strong> {remember}
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            style={{
              width: '100%', minHeight: 52, borderRadius: 14, border: 'none',
              background: primaryDisabled ? '#C5E8DA' : '#1A8966',
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: primaryDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {primaryLabel}
          </button>
        )}

        {tertiaryLabel && onTertiary && (
          <button
            type="button"
            onClick={onTertiary}
            style={{
              width: '100%', minHeight: 48, borderRadius: 14,
              border: '0.5px solid var(--border)', background: '#fff',
              color: 'var(--near-black)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tertiaryLabel}
          </button>
        )}

        <button
          type="button"
          onClick={onSecondary}
          style={{
            width: '100%', minHeight: 44, borderRadius: 14, border: 'none',
            background: 'transparent', color: 'var(--mid-grey)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  )
}

export function LessonMediaPlaceholder({ label }: { label: string }) {
  return (
    <div style={{
      borderRadius: 14,
      minHeight: 180,
      background: 'repeating-linear-gradient(-45deg, #F3EFE6, #F3EFE6 12px, #EDE8DC 12px, #EDE8DC 24px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <span style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}>
        {label}
      </span>
    </div>
  )
}
