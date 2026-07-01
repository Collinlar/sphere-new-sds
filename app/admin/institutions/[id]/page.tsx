'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
}

interface User {
  id: string
  name: string
  email: string
  role: string
  subscription_tier?: string
  created_at: string
}

const ALL_MODULES = ['assess', 'engage', 'learn', 'train']
const TIERS = ['membership', 'creator_quarterly', 'creator_marketplace', 'institution']

export default function InstitutionDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const router = useRouter()
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Edit state
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [plan, setPlan] = useState('institution')

  useEffect(() => {
    async function load() {
      const { data: inst } = await supabase
        .from('institutions')
        .select('*, institution_types(name)')
        .eq('id', id)
        .single()

      if (!inst) { setLoading(false); return }
      const parsedModules = Array.isArray(inst.modules)
        ? inst.modules
        : typeof inst.modules === 'string'
          ? JSON.parse(inst.modules)
          : []

      setInstitution(inst as Institution)
      setName(inst.name)
      setCity(inst.city ?? '')
      setModules(parsedModules)
      setPlan(inst.subscription_plan ?? 'institution')

      const { data: userRows } = await supabase
        .from('users')
        .select('id, name, email, role, subscription_tier, created_at')
        .eq('institution_id', id)
        .order('created_at', { ascending: false })

      setUsers((userRows ?? []) as User[])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    setSaving(true)
    await supabase.from('institutions').update({
      name,
      city: city || null,
      modules,
      subscription_plan: plan,
    }).eq('id', id)
    setSaving(false)
    setMsg('Saved.')
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleDelete() {
    if (confirmDelete !== institution?.name) return
    setDeleting(true)
    await supabase.from('institutions').delete().eq('id', id)
    router.push('/admin/institutions')
  }

  function toggleModule(mod: string) {
    setModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])
  }

  if (loading) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p></div>
  if (!institution) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Institution not found.</p></div>

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 860 }}>
      {/* Back */}
      <Link href="/admin/institutions" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 20 }}>
        ← All institutions
      </Link>

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>{institution.name}</p>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
          {(institution as { institution_types?: { name: string } }).institution_types?.name ?? 'Unknown type'} · {institution.city ?? 'No city'} · Created {new Date(institution.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Edit form */}
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', gridColumn: '1 / -1' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Institution settings</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', height: 38, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', height: 38, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Active modules</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ALL_MODULES.map(mod => {
                const on = modules.includes(mod)
                return (
                  <button key={mod} onClick={() => toggleModule(mod)} style={{
                    height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
                    background: on ? 'var(--near-black)' : 'var(--bg2)',
                    color: on ? '#fff' : 'var(--mid-grey)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    textTransform: 'capitalize',
                  }}>{mod}</button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Subscription plan</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIERS.map(t => (
                <button key={t} onClick={() => setPlan(t)} style={{
                  height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
                  background: plan === t ? 'var(--amber)' : 'var(--bg2)',
                  color: plan === t ? '#fff' : 'var(--mid-grey)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleSave} disabled={saving} style={{
              height: 36, padding: '0 20px', borderRadius: 8, border: 'none',
              background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>{saving ? 'Saving...' : 'Save changes'}</button>
            {msg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{msg}</p>}
          </div>
        </div>
      </div>

      {/* Users table */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Users ({users.length})</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--page-bg)' }}>
              {['Name', 'Email', 'Role', 'Joined'].map(h => (
                <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                <td style={{ padding: '11px 16px' }}>
                  <Link href={`/admin/users/${u.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', textDecoration: 'none' }}>{u.name}</Link>
                </td>
                <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{u.email}</td>
                <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{u.role}</td>
                <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Danger zone */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: '20px', border: '0.5px solid var(--coral-light)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--coral)', marginBottom: 10 }}>Danger zone</p>
        <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 12, lineHeight: 1.6 }}>
          Deleting this institution removes all associated data. Type the institution name to confirm.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            placeholder={institution.name}
            value={confirmDelete}
            onChange={e => setConfirmDelete(e.target.value)}
            style={{ flex: 1, height: 36, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleDelete}
            disabled={confirmDelete !== institution.name || deleting}
            style={{
              height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
              background: confirmDelete === institution.name ? 'var(--coral)' : 'var(--bg2)',
              color: confirmDelete === institution.name ? '#fff' : 'var(--text-tertiary)',
              fontSize: 13, fontWeight: 600, cursor: confirmDelete === institution.name ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete institution'}
          </button>
        </div>
      </div>
    </div>
  )
}
