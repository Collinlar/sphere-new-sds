'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { claimByToken, getClaimedSessions } from '@/lib/guest-sessions'

interface ClaimedSession {
  id: string
  session_type: string
  display_name?: string
  claimed_at?: string
  submission_id?: string
}

export default function StudentSettingsPage() {
  const user = getCurrentUser()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [claimCode, setClaimCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claimedSessions, setClaimedSessions] = useState<ClaimedSession[]>([])

  useEffect(() => {
    getClaimedSessions(user.id).then((rows) => setClaimedSessions(rows as ClaimedSession[]))
  }, [user.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const initials = name.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    const { error: updateError } = await supabase
      .from('users')
      .update({ name: name.trim(), avatar_initials: initials })
      .eq('id', user.id)

    if (updateError) {
      setError('Could not save your profile. Try again.')
      setSaving(false)
      return
    }

    const updated = { ...user, name: name.trim(), avatar_initials: initials }
    localStorage.setItem('sphere_user', JSON.stringify(updated))
    setSaving(false)
    setSaved(true)
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    const code = claimCode.trim().toUpperCase()
    if (code.length !== 6) {
      setClaimError('Enter the 6-character code from your results page.')
      return
    }

    setClaiming(true)
    setClaimError('')
    setClaimMsg('')

    const result = await claimByToken(code, user.id)
    setClaiming(false)

    if (!result.ok) {
      setClaimError(result.error ?? 'That code did not work.')
      return
    }

    setClaimMsg(
      result.sessionType === 'exam'
        ? 'Exam session linked to your account.'
        : 'Engage session linked to your account.'
    )
    setClaimCode('')
    const rows = await getClaimedSessions(user.id)
    setClaimedSessions(rows as ClaimedSession[])
  }

  return (
    <div style={{ padding: '20px 20px 24px' }}>
      <Link href="/student/profile" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
        ← Back to profile
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--near-black)', marginTop: 16, marginBottom: 20 }}>
        Settings
      </h1>

      <form onSubmit={handleSave}>
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>
            Display name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              width: '100%',
              height: 48,
              background: 'var(--bg2)',
              borderRadius: 8,
              padding: '0 14px',
              border: '1px solid transparent',
              fontSize: 14,
              fontFamily: 'inherit',
              marginBottom: 16,
              outline: 'none',
            }}
          />

          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{error}</p>
          )}
          {saved && (
            <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 12 }}>Profile saved.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--amber)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving profile...' : 'Save profile'}
          </button>
        </div>
      </form>

      <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>
          Recover a guest session
        </h2>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 14, lineHeight: 1.5 }}>
          Took an exam or Engage game without signing in? Enter the 6-character code from your results page.
        </p>
        <form onSubmit={handleClaim}>
          <input
            value={claimCode}
            onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="e.g. AB12CD"
            maxLength={6}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--bg2)',
              borderRadius: 8,
              padding: '0 14px',
              border: '1px solid transparent',
              fontSize: 18,
              fontFamily: 'monospace',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 12,
              outline: 'none',
            }}
          />
          {claimError && <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10 }}>{claimError}</p>}
          {claimMsg && <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 10 }}>{claimMsg}</p>}
          <button
            type="submit"
            disabled={claiming}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--teal)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: claiming ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {claiming ? 'Linking session...' : 'Link session to my account'}
          </button>
        </form>
      </div>

      {claimedSessions.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>
            Recovered sessions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {claimedSessions.map((session) => (
              <div key={session.id} style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>
                  {session.session_type === 'exam' ? 'Exam' : 'Engage'} · {session.display_name ?? 'Guest session'}
                </p>
                {session.claimed_at && (
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>
                    Linked {new Date(session.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
