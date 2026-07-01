'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  name: string
  email: string
  role: string
  subscription_tier?: string
  institution_id?: string
  created_at: string
  institutions?: { name: string }
}

const TIER_COLOR: Record<string, string> = {
  institution: '#1A8966',
  creator_marketplace: '#2E2886',
  creator_quarterly: '#D97010',
  membership: '#A09DA8',
}

const ALL_TIERS = ['all', 'membership', 'creator_quarterly', 'creator_marketplace', 'institution']

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, email, role, subscription_tier, institution_id, created_at, institutions(name)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setUsers((data ?? []) as unknown as User[])
        setLoading(false)
      })
  }, [])

  const filtered = users.filter(u => {
    if (tierFilter !== 'all' && u.subscription_tier !== tierFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Users</p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>{users.length} total</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            height: 38, background: 'var(--white)', border: '0.5px solid var(--border)',
            borderRadius: 8, padding: '0 14px', fontSize: 13, color: 'var(--near-black)',
            fontFamily: 'inherit', width: 280,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {ALL_TIERS.map(t => (
            <button key={t} onClick={() => setTierFilter(t)} style={{
              height: 36, padding: '0 14px', borderRadius: 20, border: 'none',
              background: tierFilter === t ? 'var(--near-black)' : 'var(--white)',
              color: tierFilter === t ? '#fff' : 'var(--mid-grey)',
              fontSize: 12, fontWeight: tierFilter === t ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: 'var(--shadow-soft)',
            }}>{t === 'all' ? 'All plans' : t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading users...</p>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Name', 'Email', 'Plan', 'Role', 'Institution', 'Joined'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const tier = u.subscription_tier ?? 'membership'
                const tierColor = TIER_COLOR[tier] ?? '#A09DA8'
                return (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <Link href={`/admin/users/${u.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', textDecoration: 'none' }}>{u.name}</Link>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{u.email}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tierColor, background: `${tierColor}15`, padding: '3px 8px', borderRadius: 20 }}>{tier}</span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{u.role}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(u as { institutions?: { name: string } }).institutions?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
