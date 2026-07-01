'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createGuestSession } from '@/lib/guest-sessions'

interface Props {
  sessionType: 'exam' | 'engage'
  submissionId: string
  resourceSessionId?: string
  displayName?: string
}

export default function GuestClaimBanner({ sessionType, submissionId, resourceSessionId = '', displayName = 'Guest' }: Props) {
  const [claimToken, setClaimToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) return  // signed-in user, banner not needed
      setIsGuest(true)
      createGuestSession({ sessionType, submissionId, resourceSessionId, displayName }).then(result => {
        if (result?.claimToken) setClaimToken(result.claimToken)
      })
    })
  }, [sessionType, submissionId])

  if (!isGuest || !claimToken) return null

  function copy() {
    navigator.clipboard.writeText(claimToken!).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      background: 'var(--navy)',
      borderRadius: 14,
      padding: '20px 20px 22px',
      marginBottom: 14,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
        Save your {sessionType === 'exam' ? 'exam result' : 'score'}
      </p>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 18 }}>
        You submitted as a guest. Use this code to claim your result after you create an account, even on a different device.
      </p>

      {/* Token display */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '14px 18px',
          letterSpacing: '0.3em',
          fontSize: 26,
          fontWeight: 800,
          color: '#fff',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {claimToken}
        </div>
        <button
          onClick={copy}
          style={{
            height: 52,
            padding: '0 18px',
            borderRadius: 10,
            border: 'none',
            background: copied ? 'var(--teal)' : 'rgba(255,255,255,0.12)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <circle cx="4.5" cy="3" r="1" fill="rgba(255,255,255,0.5)" />
            <rect x="3.75" y="4.5" width="1.5" height="3" rx="0.75" fill="rgba(255,255,255,0.5)" />
          </svg>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          Create a free account at{' '}
          <a href="/signup" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>spheresds.com/signup</a>
          {' '}and enter this code in your dashboard to claim this result.
        </p>
      </div>
    </div>
  )
}
