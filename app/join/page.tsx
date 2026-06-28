'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')

    // Try engage session first
    const { data: engageSession } = await supabase
      .from('engage_sessions')
      .select('id, status')
      .eq('join_code', trimmed)
      .single()

    if (engageSession) {
      if (engageSession.status === 'ended') {
        setError('That game has already ended. Ask your teacher for a new code.')
        setLoading(false)
        return
      }
      router.push(`/student/engage/${trimmed}`)
      return
    }

    // Try assess session
    const { data: examSession } = await supabase
      .from('exam_sessions')
      .select('id, status')
      .eq('join_code', trimmed)
      .single()

    if (examSession) {
      if (examSession.status === 'completed') {
        setError('That exam has already closed. Check with your teacher.')
        setLoading(false)
        return
      }
      router.push(`/student/assess/${trimmed}`)
      return
    }

    // Try personal ticket code
    const { data: ticket } = await supabase
      .from('exam_tickets')
      .select('id')
      .eq('code', trimmed)
      .single()

    if (ticket) {
      router.push(`/student/assess/${trimmed}`)
      return
    }

    setLoading(false)
    setError('We could not find that code. Check it and try again.')
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
            Enter your code
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
            Your teacher will show this on the board
          </p>
        </div>

        <div className="sphere-card" style={{ padding: 28 }}>
          <form onSubmit={handleJoin}>
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                placeholder="e.g. XK7P2Q or MAEF-HJYY"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={9}
                autoFocus
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
                onFocus={(e) => { e.currentTarget.style.borderColor = '#D97010' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
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
