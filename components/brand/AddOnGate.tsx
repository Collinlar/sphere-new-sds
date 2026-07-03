'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { assertAddOnAccess, type AddOnCheckResult } from '@/lib/subscription'
import type { AddOnId } from '@/lib/types'

const ADDON_LABELS: Record<AddOnId, string> = {
  ai_course_builder: 'AI Course Builder',
  ai_assessment_builder: 'AI Assessment Builder',
  ai_hints: 'AI Hints',
  ai_explanations: 'AI Explanations',
  ai_training_builder: 'AI Training Builder',
}

interface Props {
  addOnId: AddOnId
  children: (props: { check: () => Promise<boolean> }) => React.ReactNode
}

export default function AddOnGate({ addOnId, children }: Props) {
  const [blocked, setBlocked] = useState(false)
  const [reason, setReason] = useState('')
  const [needsPlanUpgrade, setNeedsPlanUpgrade] = useState(false)

  const check = useCallback(async (): Promise<boolean> => {
    const result: AddOnCheckResult = await assertAddOnAccess(addOnId)
    if (!result.allowed) {
      setReason(result.reason ?? 'This add-on is not on your plan.')
      setNeedsPlanUpgrade(result.needsPlanUpgrade ?? false)
      setBlocked(true)
      return false
    }
    return true
  }, [addOnId])

  useEffect(() => {
    if (!blocked) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBlocked(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocked])

  const label = ADDON_LABELS[addOnId]

  return (
    <>
      {children({ check })}

      {blocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="addon-gate-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 24,
          }}
          onClick={() => setBlocked(false)}
        >
          <div
            style={{
              background: 'var(--white)',
              borderRadius: 14,
              padding: '28px 26px',
              maxWidth: 400,
              width: '100%',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p id="addon-gate-title" style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>
              {label} not available
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 20 }}>
              {reason}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link
                href={needsPlanUpgrade ? '/platform/settings/billing' : '/platform/settings/billing'}
                style={{
                  display: 'flex',
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: '#2E2886',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {needsPlanUpgrade ? 'Upgrade your plan' : 'Add to your plan'}
              </Link>
              <button
                type="button"
                onClick={() => setBlocked(false)}
                style={{
                  height: 40,
                  background: 'var(--bg2)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--mid-grey)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
