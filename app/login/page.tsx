'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { autoClaimBrowserSessions } from '@/lib/guest-sessions'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('That email and password did not match. Try again.')
      setLoading(false)
      return
    }

    await autoClaimBrowserSessions(data.user.id)

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*, institutions(name, modules)')
      .eq('id', data.user.id)
      .single()

    if (userError || !userRecord) {
      setError('Your institution setup did not complete. Go to Set up your account below and try again with the same email.')
      setLoading(false)
      return
    }

    localStorage.setItem('sphere_user', JSON.stringify(userRecord))
    if (userRecord?.institutions?.name) {
      localStorage.setItem('sphere_institution', userRecord.institutions.name)
    }

    const modules = userRecord?.institutions?.modules ?? {}

    const moduleRoutes: Record<string, string> = {
      engage: '/engage',
      assess: '/assess',
      learn: '/learn',
      train: '/train',
    }

    const roleRoutes: Record<string, string> = {
      admin: '/platform/analytics',
      teacher: '/engage',
      student: '/student/learn',
      hr: '/train',
      employee: '/employee/train/demo',
    }

    if (['teacher', 'admin'].includes(userRecord?.role)) {
      const firstActive = (['engage', 'assess', 'learn', 'train'] as const).find(m => modules[m]) ?? 'engage'
      router.push(moduleRoutes[firstActive])
    } else {
      router.push(roleRoutes[userRecord?.role] ?? '/engage')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'var(--bg2)',
    fontSize: 16,
    fontFamily: 'inherit',
    color: 'var(--near-black)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#D5D4D1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
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
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="var(--amber)" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="5" ry="11" stroke="var(--amber)" strokeWidth="1.2" />
              <line x1="1" y1="12" x2="23" y2="12" stroke="var(--amber)" strokeWidth="1.2" />
              <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="var(--amber)" strokeWidth="1" />
              <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="var(--amber)" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--near-black)' }}>
              Sphere<span style={{ color: 'var(--amber)' }}>SDS</span>
            </span>
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Welcome back
          </p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginTop: 6 }}>Sign in to your institution</p>
        </div>

        <div style={{
          background: 'var(--white)',
          borderRadius: 12,
          padding: '28px 24px',
          boxShadow: 'var(--shadow-soft)',
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="name@institution.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>

            <div style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)' }}>
                  Password
                </label>
                <a href="/forgot-password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--coral-light)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
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
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Signing you in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
            Joining a quiz or exam?{' '}
            <a href="/join" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
              Enter your code
            </a>
          </p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
            New institution?{' '}
            <a href="/onboarding" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
              Set up your account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
