'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Institution {
  id: string
  name: string
  city?: string
  subscription_plan?: string
  modules?: string[]
  institution_type_id?: string
  created_at: string
  institution_types?: { name: string }
  user_count?: number
}

const TIER_COLOR: Record<string, string> = {
  institution: '#1A8966',
  creator_marketplace: '#2E2886',
  creator_quarterly: '#D97010',
  membership: '#A09DA8',
}

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('institutions')
      .select('*, institution_types(name)')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return }

        // Count users per institution
        const withCounts = await Promise.all(
          data.map(async (inst) => {
            const { count } = await supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('institution_id', inst.id)
            return { ...inst, user_count: count ?? 0 }
          })
        )
        setInstitutions(withCounts.map(i => ({
          ...i,
          modules: Array.isArray(i.modules)
            ? i.modules
            : typeof i.modules === 'string'
              ? JSON.parse(i.modules)
              : [],
        })) as Institution[])
        setLoading(false)
      })
  }, [])

  const filtered = institutions.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Institutions</p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>{institutions.length} total</p>
      </div>

      <input
        placeholder="Search by name or city..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', maxWidth: 360, height: 40, background: 'var(--white)',
          border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 14px',
          fontSize: 13, color: 'var(--near-black)', fontFamily: 'inherit',
          boxSizing: 'border-box', marginBottom: 18,
        }}
      />

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading institutions...</p>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Name', 'Type', 'City', 'Modules', 'Users', 'Plan', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst, i) => {
                const tier = inst.subscription_plan ?? 'membership'
                const tierColor = TIER_COLOR[tier] ?? '#A09DA8'
                return (
                  <tr
                    key={inst.id}
                    style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/institutions/${inst.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', textDecoration: 'none' }}>
                        {inst.name}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(inst as { institution_types?: { name: string } }).institution_types?.name ?? 'Unset'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{inst.city ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(inst.modules ?? []).map(m => (
                          <span key={m} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 20, background: 'var(--bg2)', color: 'var(--mid-grey)' }}>{m}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--near-black)', fontWeight: 600 }}>{inst.user_count}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tierColor, background: `${tierColor}15`, padding: '3px 9px', borderRadius: 20 }}>
                        {tier}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(inst.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No institutions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
