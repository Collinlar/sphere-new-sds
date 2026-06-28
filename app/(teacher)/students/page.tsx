'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/codes'
import { getCurrentUser } from '@/lib/auth'
import type { Roster } from '@/lib/types'

interface RosterRow extends Roster {
  member_count: number
}

export default function RostersPage() {
  const [rosters, setRosters] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('rosters')
      .select('*, roster_members(count)')
      .eq('institution_id', getCurrentUser().institution_id)
      .order('created_at', { ascending: false })

    const mapped: RosterRow[] = (data ?? []).map((r) => ({
      ...r,
      member_count: (r as { roster_members: { count: number }[] }).roster_members?.[0]?.count ?? 0,
    }))
    setRosters(mapped)
    setLoading(false)
  }

  async function createRoster() {
    if (!newName.trim()) return
    setCreating(true)
    const user = getCurrentUser()
    const { error } = await supabase.from('rosters').insert({
      institution_id: user.institution_id,
      creator_id: user.id,
      name: newName.trim(),
      invite_code: generateCode(6),
    })
    setCreating(false)
    if (!error) {
      setNewName('')
      setShowCreate(false)
      load()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="students"
        title="My students"
        right={
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + New roster
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 24, maxWidth: 560, lineHeight: 1.6 }}>
          A roster is your list of students. Build it once, then use it to lock any exam or course to your own class instead of leaving it open to anyone with a code.
        </p>

        {showCreate && (
          <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', marginBottom: 20, maxWidth: 420 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10 }}>Name your roster</p>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. JHS 2 Science, Afternoon set"
              autoFocus
              style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={createRoster}
                disabled={creating || !newName.trim()}
                style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: creating || !newName.trim() ? 0.6 : 1 }}
              >
                {creating ? 'Creating...' : 'Create roster'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName('') }}
                style={{ background: 'transparent', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading your rosters...</p>}

        {!loading && rosters.length === 0 && !showCreate && (
          <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '56px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>No rosters yet</p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 20 }}>Create one to start registering your students.</p>
            <button
              onClick={() => setShowCreate(true)}
              style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Create your first roster
            </button>
          </div>
        )}

        {!loading && rosters.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {rosters.map(r => (
              <Link key={r.id} href={`/students/${r.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px' }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>{r.name}</p>
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                    {r.member_count} {r.member_count === 1 ? 'student' : 'students'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
