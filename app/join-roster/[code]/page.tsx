'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

export default function JoinRosterPage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const { code } = use(paramsPromise)
  const [rosterName, setRosterName] = useState<string | null>(null)
  const [rosterId, setRosterId] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('rosters')
        .select('id, name, institution_id')
        .eq('invite_code', code.toUpperCase())
        .single()

      if (!data) { setLoading(false); return }
      setRosterId(data.id)
      setRosterName(data.name)
      setInstitutionId(data.institution_id)
      setLoading(false)
    }
    load()
  }, [code])

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !rosterId) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/rosters/${rosterId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution_id: institutionId,
        status: 'pending',
        members: [{ name: name.trim(), email: email.trim() }],
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Could not submit your request.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading...</p>
      </div>
    )
  }

  if (!rosterId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Link not found</p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This join link is not valid. Ask your teacher for a new one.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✓</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Request sent</p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', maxWidth: 320 }}>Your teacher needs to approve you before you show up on {rosterName}. Check back soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6, textAlign: 'center' }}>
          Join {rosterName}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', textAlign: 'center', marginBottom: 24 }}>
          Tell us who you are so your teacher can add you.
        </p>

        <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What's your name?"
            style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="What's your email?"
            type="email"
            style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }}
          />

          {error && (
            <div style={{ background: '#FDECEA', border: '1px solid #E05C4B', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#7A1A10' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !email.trim()}
            style={{ width: '100%', height: 46, background: '#36318F', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: submitting || !name.trim() || !email.trim() ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {submitting ? 'Sending request...' : 'Ask to join'}
          </button>
        </div>
      </div>
    </div>
  )
}
