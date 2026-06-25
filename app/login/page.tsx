'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    background: '#EAE6DC',
    fontSize: 16,
    fontFamily: 'inherit',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EFE9DD',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="#EF9F27" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#EF9F27" strokeWidth="1.2" />
              <line x1="1" y1="12" x2="23" y2="12" stroke="#EF9F27" strokeWidth="1.2" />
              <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#EF9F27" strokeWidth="1" />
              <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#EF9F27" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827' }}>
              Sphere<span style={{ color: '#EF9F27' }}>SDS</span>
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#4B5563' }}>Sign in to your institution</p>
        </div>

        <div style={{
          background: '#fff',
          border: '0.5px solid #E2DDD3',
          borderRadius: 12,
          padding: 28,
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4B5563', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="What's your work email?"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4B5563', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>

            {error && (
              <div style={{
                background: '#FDECEA',
                border: '1px solid #E05C4B',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#7A1A10',
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
                background: '#EF9F27',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Signing you in...' : 'Sign in to your institution'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#4B5563' }}>
          Joining a quiz or exam?{' '}
          <a href="/join" style={{ color: '#EF9F27', fontWeight: 500, textDecoration: 'none' }}>
            Enter your code here
          </a>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 14, color: '#4B5563' }}>
          New institution?{' '}
          <a href="/onboarding" style={{ color: '#EF9F27', fontWeight: 500, textDecoration: 'none' }}>
            Set up your account
          </a>
        </p>
      </div>
    </div>
  )
}
