'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { claimMembershipByCode, setActiveContext } from '@/lib/context'

export default function ClaimPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)

  async function handleClaim() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      setError('Your claim code is 6 characters. Check it and try again.')
      return
    }

    setClaiming(true)
    setError('')

    const user = getCurrentUser()
    const membership = await claimMembershipByCode(trimmed, user.id)

    if (!membership) {
      setError('That code did not match a pending invite. Check with your institution and try again.')
      setClaiming(false)
      return
    }

    // Land directly in the new institution context
    setActiveContext({
      type: 'institution',
      institutionId: membership.institution_id,
      institutionName: membership.institution_name,
      memberRole: membership.member_role,
    })
    router.push('/home')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Join an institution" />

      <div style={{ padding: '28px 32px', maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Claim your membership</h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24, lineHeight: 1.6 }}>
          If a school, company, or training institution added you as a member, they gave you a 6-character claim code. Enter it here to join their workspace.
        </p>

        <div className="sphere-card">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Claim code
          </label>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleClaim() }}
            placeholder="e.g. K7M2XR"
            maxLength={6}
            style={{
              width: '100%', height: 54, padding: '0 16px', borderRadius: 10,
              border: '1.5px solid var(--border)', background: 'var(--white)',
              fontSize: 22, fontWeight: 700, letterSpacing: '0.25em',
              fontFamily: 'monospace', textAlign: 'center', textTransform: 'uppercase',
              outline: 'none', boxSizing: 'border-box', marginBottom: 14,
              color: 'var(--near-black)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2E2886' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />

          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleClaim}
            disabled={claiming || code.trim().length < 6}
            style={{
              width: '100%', height: 46, borderRadius: 8, border: 'none',
              background: code.trim().length >= 6 && !claiming ? '#2E2886' : 'var(--bg2)',
              color: code.trim().length >= 6 && !claiming ? '#fff' : 'var(--mid-grey)',
              fontSize: 14, fontWeight: 600,
              cursor: code.trim().length >= 6 && !claiming ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {claiming ? 'Checking your code...' : 'Join my institution'}
          </button>
        </div>
      </div>
    </div>
  )
}
