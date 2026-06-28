'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { IconLock } from '@/components/icons'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError('We could not send that reset link. Check your email and try again.')
      setLoading(false)
      return
    }

    router.push(`/forgot-password/sent?email=${encodeURIComponent(email.trim())}`)
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
        padding: '48px 32px 44px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'var(--amber-light)',
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--amber)',
          }}>
            <IconLock size={26} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Forgot your password?
          </p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.55 }}>
            Enter your work email and we will send a reset link. Valid for 15 minutes.
          </p>
        </div>

        <div style={{
          background: 'var(--white)',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-soft)',
          marginBottom: 14,
        }}>
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@institution.edu.gh"
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
                color: 'var(--near-black)',
                marginBottom: 18,
                outline: 'none',
              }}
            />

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
              disabled={loading}
              style={{
                width: '100%',
                height: 48,
                background: 'var(--amber)',
                borderRadius: 8,
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Sending reset link...' : 'Send reset link →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--mid-grey)' }}>
          Remembered it?{' '}
          <Link href="/login" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
