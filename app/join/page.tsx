'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveJoinCode } from '@/lib/join-session'

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const autoTried = useRef(false)

  async function joinWithCode(raw: string) {
    const trimmed = raw.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')
    const result = await resolveJoinCode(trimmed)
    if (result.ok) {
      router.replace(result.href)
      return
    }
    setLoading(false)
    setError(result.error)
  }

  useEffect(() => {
    const fromUrl = searchParams.get('code')
    if (!fromUrl || autoTried.current) return
    autoTried.current = true
    const normalised = fromUrl.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9)
    setCode(normalised)
    void joinWithCode(normalised)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    await joinWithCode(code)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--page-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="#D97010" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#D97010" strokeWidth="1.2" />
              <line x1="1" y1="12" x2="23" y2="12" stroke="#D97010" strokeWidth="1.2" />
              <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#D97010" strokeWidth="1" />
              <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#D97010" strokeWidth="1" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--near-black)' }}>
              Sphere<span style={{ color: '#D97010' }}>SDS</span>
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>
            {loading && code ? 'Opening your session' : 'Enter your code'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
            {loading && code
              ? `Looking up ${code}…`
              : 'Your teacher will show this on the board'}
          </p>
        </div>

        <div className="sphere-card" style={{ padding: 28 }}>
          <form onSubmit={handleJoin}>
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                name="session-code"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                placeholder="e.g. XK7P2Q or MAEF-HJYY"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))}
                maxLength={9}
                autoFocus={!searchParams.get('code')}
                suppressHydrationWarning
                disabled={loading}
                style={{
                  width: '100%',
                  height: 64,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid transparent',
                  background: 'var(--bg2)',
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textAlign: 'center',
                  fontFamily: 'var(--font)',
                  color: 'var(--near-black)',
                  outline: 'none',
                  textTransform: 'uppercase',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#FDECEA',
                border: '1px solid #C23B2A',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#C23B2A',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              suppressHydrationWarning
              style={{
                width: '100%',
                height: 52,
                background: '#D97010',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 500,
                cursor: (loading || !code.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !code.trim()) ? 0.6 : 1,
                fontFamily: 'var(--font)',
              }}
            >
              {loading ? 'Finding your session...' : 'Join now'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--mid-grey)' }}>
          <a href="/login" style={{ color: 'var(--mid-grey)', textDecoration: 'none' }}>
            Teacher? Sign in here
          </a>
        </p>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
        Opening join…
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  )
}
