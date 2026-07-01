'use client'

import { useState, useEffect, useCallback } from 'react'
import { canCreate, type Module } from '@/lib/subscription'
import type { CreationUsage } from '@/lib/types'
import { getCreationUsage } from '@/lib/subscription'
import { getCurrentUser } from '@/lib/auth'

const MODULE_COLOR: Record<Module, string> = {
  assess: '#C23B2A',
  engage: '#D97010',
  learn: '#1A8966',
  train: '#1052A3',
}

const PLAN_LABELS: Record<string, string> = {
  membership: 'Membership',
  creator_quarterly: 'Creator Quarterly',
  creator_marketplace: 'Creator Marketplace',
  institution: 'Institution',
}

const UPGRADE_PERKS: Record<string, string[]> = {
  membership: [
    'Up to 40 creations across all modules',
    '50 students per live session',
    'Publish to the marketplace',
    'Issue certificates',
  ],
  creator_quarterly: [
    'Unlimited creations',
    'Unlimited marketplace buyers',
    '30% commission — keep 70%',
    'Issue certificates',
  ],
}

interface Props {
  module: Module
  children: (props: { check: () => Promise<boolean> }) => React.ReactNode
  className?: string
}

export default function CreationGate({ module, children }: Props) {
  const [blocked, setBlocked] = useState(false)
  const [reason, setReason] = useState('')
  const [usage, setUsage] = useState<CreationUsage | null>(null)
  const [tier, setTier] = useState<string>('membership')

  useEffect(() => {
    const user = getCurrentUser()
    setTier((user as { subscription_tier?: string }).subscription_tier ?? 'membership')
    getCreationUsage().then(u => setUsage(u))
  }, [])

  const check = useCallback(async (): Promise<boolean> => {
    const result = await canCreate(module)
    if (!result.allowed) {
      setReason(result.reason ?? 'Your plan limit has been reached.')
      setUsage(await getCreationUsage())
      setBlocked(true)
      return false
    }
    return true
  }, [module])

  const accent = MODULE_COLOR[module]
  const usedKey = `${module}_used` as keyof CreationUsage
  const quotaKey = `${module}_quota` as keyof CreationUsage
  const used = usage ? (usage[usedKey] as number) : 0
  const quota = usage ? (usage[quotaKey] as number) : 0

  // Determine which upgrade is relevant
  const nextPlan = tier === 'membership' ? 'creator_quarterly' : 'creator_marketplace'
  const perks = UPGRADE_PERKS[tier] ?? UPGRADE_PERKS.membership

  return (
    <>
      {children({ check })}

      {blocked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 24,
        }}>
          <div style={{
            background: 'var(--page-bg)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-card)',
            maxWidth: 380,
            width: '100%',
            overflow: 'hidden',
          }}>
            {/* Header strip */}
            <div style={{ background: accent, padding: '22px 24px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                {PLAN_LABELS[tier]} plan
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                You have reached your {module} limit
              </p>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              {/* Usage indicator */}
              {quota > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Used this period</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--near-black)' }}>{used} of {quota}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((used / Math.max(quota, 1)) * 100, 100)}%`,
                      background: accent,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              )}

              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 18, lineHeight: 1.6 }}>
                {reason}
              </p>

              {/* Upgrade perks */}
              <div style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  Upgrade to {PLAN_LABELS[nextPlan]}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {perks.map((perk, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'var(--teal-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3 5.5L6.5 2" stroke="#1A8966" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--near-black)', lineHeight: 1.5 }}>{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setBlocked(false)}
                  style={{
                    flex: 1,
                    height: 42,
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
                  Not now
                </button>
                <a
                  href="/platform/settings/billing"
                  style={{
                    flex: 2,
                    height: 42,
                    background: 'var(--amber)',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Upgrade my plan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
