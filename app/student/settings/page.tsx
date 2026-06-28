'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function StudentSettingsPage() {
  const user = getCurrentUser()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div style={{ padding: '20px 20px 24px' }}>
      <Link href="/student/profile" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
        ← Back to profile
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--near-black)', marginTop: 16, marginBottom: 20 }}>
        Settings
      </h1>

      <form onSubmit={handleSave}>
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
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
              height: 44,
              background: 'var(--teal)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
