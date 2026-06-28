'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { IconCheckCircle, IconXCircle } from '@/components/icons'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else {
        const hash = window.location.hash
        if (hash.includes('access_token')) setReady(true)
        else setError('Your reset link expired. Request a new one from the sign in page.')
      }
    })
  }, [])

  const hasLength = password.length >= 8
  const hasNumber = /\d/.test(password)
  const passwordsMatch = password.length > 0 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasLength || !hasNumber || !passwordsMatch) return

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('That did not go through. Request a new reset link and try again.')
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#D5D4D1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--page-bg)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card)',
        padding: '44px 32px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Set a new password
          </p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Must be at least 8 characters.</p>
        </div>

        <div style={{
          background: 'var(--white)',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-soft)',
          marginBottom: 14,
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>
                New password
              </label>
              <div style={{
                height: 48,
                background: 'var(--bg2)',
                borderRadius: 8,
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    color: 'var(--near-black)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>
                Confirm password
              </label>
              <div style={{
                height: 48,
                background: 'var(--bg2)',
                borderRadius: 8,
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    color: 'var(--near-black)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {[
                { ok: hasLength, label: '8+ characters' },
                { ok: hasNumber, label: 'Includes a number' },
                { ok: passwordsMatch, label: 'Passwords match' },
              ].map(rule => (
                <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: rule.ok ? 'var(--teal)' : 'var(--text-tertiary)' }}>
                    {rule.ok ? <IconCheckCircle size={14} /> : <IconXCircle size={14} />}
                  </span>
                  <span style={{ fontSize: 12, color: rule.ok ? 'var(--teal)' : 'var(--text-tertiary)' }}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                background: 'var(--coral-light)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 13,
                color: 'var(--coral)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !ready || !hasLength || !hasNumber || !passwordsMatch}
              style={{
                width: '100%',
                height: 48,
                background: 'var(--teal)',
                borderRadius: 8,
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading || !ready ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Setting password...' : 'Set password →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--mid-grey)' }}>
          <Link href="/login" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
