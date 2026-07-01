'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface InstitutionType {
  id: string
  name: string
  period_language: string
  period_count: number
  is_custom: boolean
  is_active?: boolean
}

interface StaffUser {
  id: string
  name: string
  email: string
  is_sphere_staff: boolean
}

const SEED_TYPE_IDS = ['primary', 'jhs', 'shs', 'university', 'college', 'training', 'corporate', 'professional']

export default function ConfigPage() {
  const [instTypes, setInstTypes] = useState<InstitutionType[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [guestTTL, setGuestTTL] = useState(30)
  const [loading, setLoading] = useState(true)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffSearchResults, setStaffSearchResults] = useState<StaffUser[]>([])
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')

  // New institution type form
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypePeriod, setNewTypePeriod] = useState('Terms')
  const [newTypePeriodCount, setNewTypePeriodCount] = useState(3)
  const [addingType, setAddingType] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: typeData }, { data: staffData }] = await Promise.all([
        supabase.from('institution_types').select('*').order('is_custom').order('name'),
        supabase.from('users').select('id, name, email, is_sphere_staff').eq('is_sphere_staff', true),
      ])
      setInstTypes((typeData ?? []) as InstitutionType[])
      setStaff((staffData ?? []) as StaffUser[])
      setLoading(false)
    }
    load()
  }, [])

  function flash(msg: string) {
    setMsg(msg)
    setTimeout(() => setMsg(''), 3500)
  }

  async function addInstitutionType() {
    if (!newTypeName.trim()) return
    setAddingType(true)
    const id = newTypeName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
    const { data } = await supabase.from('institution_types').insert({
      id: `custom_${id}_${Date.now()}`,
      name: newTypeName.trim(),
      period_language: newTypePeriod,
      period_count: newTypePeriodCount,
      levels: [],
      is_custom: true,
    }).select().single()
    if (data) setInstTypes(prev => [...prev, data as InstitutionType])
    setNewTypeName('')
    setAddingType(false)
    flash('Institution type added.')
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setStaffSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, name, email, is_sphere_staff')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    setStaffSearchResults((data ?? []) as StaffUser[])
    setSearching(false)
  }

  async function toggleStaff(user: StaffUser) {
    const newVal = !user.is_sphere_staff
    await supabase.from('users').update({ is_sphere_staff: newVal }).eq('id', user.id)
    if (newVal) {
      setStaff(prev => [...prev.filter(s => s.id !== user.id), { ...user, is_sphere_staff: true }])
      flash(`${user.name} granted staff access.`)
    } else {
      setStaff(prev => prev.filter(s => s.id !== user.id))
      flash(`${user.name} removed from staff.`)
    }
    setStaffSearchResults(prev => prev.map(u => u.id === user.id ? { ...u, is_sphere_staff: newVal } : u))
  }

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Platform config</p>
        </div>
        {msg && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', padding: '7px 14px', borderRadius: 20 }}>{msg}</p>}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Institution types */}
          <section style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>Institution types</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>The 8 default types are protected and cannot be deleted. Custom types can be removed.</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Name', 'Period language', 'Periods', 'Type'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instTypes.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{t.name}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{t.period_language}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{t.period_count}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {t.is_custom ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#D97010', background: '#FEF0DC', padding: '3px 8px', borderRadius: 20 }}>Custom</span>
                          <button
                            onClick={async () => {
                              await supabase.from('institution_types').delete().eq('id', t.id)
                              setInstTypes(prev => prev.filter(x => x.id !== t.id))
                              flash('Type removed.')
                            }}
                            style={{ fontSize: 11, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>Default</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add custom type */}
            <div style={{ padding: '16px 20px', borderTop: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10 }}>Add custom type</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Name</label>
                  <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g. Polytechnic" style={{ height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', width: 180 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Period word</label>
                  <input value={newTypePeriod} onChange={e => setNewTypePeriod(e.target.value)} placeholder="Terms" style={{ height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', width: 120 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Count</label>
                  <input type="number" min={1} max={12} value={newTypePeriodCount} onChange={e => setNewTypePeriodCount(Number(e.target.value))} style={{ height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', width: 60 }} />
                </div>
                <button onClick={addInstitutionType} disabled={addingType || !newTypeName.trim()} style={{
                  height: 34, padding: '0 16px', borderRadius: 7, border: 'none',
                  background: newTypeName.trim() ? 'var(--amber)' : 'var(--bg2)',
                  color: newTypeName.trim() ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 13, fontWeight: 600, cursor: newTypeName.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}>{addingType ? 'Adding...' : 'Add type'}</button>
              </div>
            </div>
          </section>

          {/* Guest session TTL */}
          <section style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)', marginBottom: 4 }}>Guest session expiry</p>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 14 }}>How many days before unclaimed guest sessions expire. Currently {guestTTL} days.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                min={7}
                max={90}
                value={guestTTL}
                onChange={e => setGuestTTL(Number(e.target.value))}
                style={{ height: 34, width: 80, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>days</span>
              <button onClick={() => flash('Guest TTL saved (schema-enforced — update via migration).')} style={{
                height: 34, padding: '0 16px', borderRadius: 7, border: 'none',
                background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Save</button>
            </div>
          </section>

          {/* Staff access */}
          <section style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)', marginBottom: 2 }}>Sphere staff</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Users with access to this admin panel.</p>
            </div>

            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)' }}>
              <input
                placeholder="Search users by name or email to add staff..."
                value={staffSearch}
                onChange={e => { setStaffSearch(e.target.value); searchUsers(e.target.value) }}
                style={{ width: '100%', height: 36, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              {staffSearchResults.length > 0 && (
                <div style={{ marginTop: 8, border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {staffSearchResults.map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none', background: 'var(--white)' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</p>
                      </div>
                      <button onClick={() => toggleStaff(u)} style={{
                        height: 28, padding: '0 12px', borderRadius: 20, border: 'none',
                        background: u.is_sphere_staff ? 'var(--coral-light)' : 'var(--teal-light)',
                        color: u.is_sphere_staff ? 'var(--coral)' : 'var(--teal)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{u.is_sphere_staff ? 'Remove' : 'Grant access'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current staff */}
            {staff.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</p>
                </div>
                <button onClick={() => toggleStaff(u)} style={{
                  height: 28, padding: '0 12px', borderRadius: 20, border: 'none',
                  background: 'var(--coral-light)', color: 'var(--coral)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>Remove</button>
              </div>
            ))}
            {staff.length === 0 && (
              <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-tertiary)' }}>No staff users yet. Search above to add one.</p>
            )}
          </section>

        </div>
      )}
    </div>
  )
}
