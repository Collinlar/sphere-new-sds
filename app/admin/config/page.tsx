'use client'

import { useEffect, useState, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { getPlatformSetting, getPlatformSettingNumber, setPlatformSetting, GUEST_TTL_KEY, DEFAULT_GUEST_TTL_DAYS } from '@/lib/platform-settings'
import { TRUSTED_DOMAINS_KEY } from '@/lib/institution-verification'

interface TypeLevel { id: string; label: string }

interface InstitutionType {
  id: string
  name: string
  period_language: string
  period_count: number
  academic_year_start_month?: number | null
  level_language?: string
  calendar_language?: string
  has_academic_calendar?: boolean
  levels?: TypeLevel[]
  is_custom: boolean
  is_active?: boolean
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
  const [guestTTL, setGuestTTL] = useState(DEFAULT_GUEST_TTL_DAYS)
  const [savingTTL, setSavingTTL] = useState(false)
  const [trustedDomains, setTrustedDomains] = useState('')
  const [savingDomains, setSavingDomains] = useState(false)
  const [loading, setLoading] = useState(true)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffSearchResults, setStaffSearchResults] = useState<StaffUser[]>([])
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  async function saveType(patch: InstitutionType) {
    await supabase.from('institution_types').update({
      period_language: patch.period_language,
      period_count: patch.period_count,
      academic_year_start_month: patch.academic_year_start_month ?? null,
      level_language: patch.level_language || 'Level',
      calendar_language: patch.calendar_language || 'Academic year',
      has_academic_calendar: patch.has_academic_calendar ?? true,
      levels: patch.levels ?? [],
    }).eq('id', patch.id)
    setInstTypes(prev => prev.map(t => t.id === patch.id ? patch : t))
    setEditingId(null)
    flash(`${patch.name} updated.`)
  }

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
      setGuestTTL(await getPlatformSettingNumber(GUEST_TTL_KEY, DEFAULT_GUEST_TTL_DAYS))
      setTrustedDomains(await getPlatformSetting(TRUSTED_DOMAINS_KEY, ''))
      setLoading(false)
    }
    load()
  }, [])

  async function saveGuestTTL() {
    setSavingTTL(true)
    const result = await setPlatformSetting(GUEST_TTL_KEY, String(guestTTL))
    setSavingTTL(false)
    flash(result.ok ? `Guest sessions now expire after ${guestTTL} days.` : 'That did not save. Try again.')
  }

  async function saveTrustedDomains() {
    setSavingDomains(true)
    const cleaned = trustedDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean).join(', ')
    const result = await setPlatformSetting(TRUSTED_DOMAINS_KEY, cleaned)
    setTrustedDomains(cleaned)
    setSavingDomains(false)
    flash(result.ok ? 'Trusted domains saved.' : 'That did not save. Try again.')
  }

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
                  <Fragment key={t.id}>
                    <tr style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{t.name}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{t.period_language}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{t.period_count}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {t.is_custom ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#D97010', background: '#FEF0DC', padding: '3px 8px', borderRadius: 20 }}>Custom</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>Default</span>
                          )}
                          <button
                            onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                            style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}
                          >
                            {editingId === t.id ? 'Close' : 'Edit'}
                          </button>
                          {t.is_custom && (
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
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === t.id && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, background: 'var(--page-bg)' }}>
                          <TypeEditor type={t} onCancel={() => setEditingId(null)} onSave={saveType} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 14 }}>How many days before unclaimed guest sessions expire. New guest sessions use this value.</p>
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
              <button onClick={saveGuestTTL} disabled={savingTTL} style={{
                height: 34, padding: '0 16px', borderRadius: 7, border: 'none',
                background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: savingTTL ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>{savingTTL ? 'Saving...' : 'Save'}</button>
            </div>
          </section>

          {/* Trusted verification domains */}
          <section style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)', marginBottom: 4 }}>Auto-verify email domains</p>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 14, lineHeight: 1.5 }}>
              Institutions whose owner signs up on one of these domains are verified automatically. Educational and government domains (.edu, .edu.gh, .gov.gh, .ac.*) are always trusted. Add extra domains here, comma separated. Free providers like gmail never auto-verify.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={trustedDomains}
                onChange={e => setTrustedDomains(e.target.value)}
                placeholder="e.g. ashesi.edu.gh, mycompany.com"
                style={{ flex: 1, minWidth: 240, height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button onClick={saveTrustedDomains} disabled={savingDomains} style={{
                height: 34, padding: '0 16px', borderRadius: 7, border: 'none',
                background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: savingDomains ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>{savingDomains ? 'Saving...' : 'Save'}</button>
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

// Inline editor for an institution type: period language/count, academic
// calendar start month, and the seeded level list. Levels feed every level
// dropdown in the app, so editing here changes what institutions of this
// type can assign content to.
function TypeEditor({ type, onCancel, onSave }: { type: InstitutionType; onCancel: () => void; onSave: (t: InstitutionType) => void }) {
  const [periodLang, setPeriodLang] = useState(type.period_language)
  const [periodCount, setPeriodCount] = useState(type.period_count)
  const [startMonth, setStartMonth] = useState<number | ''>(type.academic_year_start_month ?? '')
  const [levelLang, setLevelLang] = useState(type.level_language || 'Level')
  const [calendarLang, setCalendarLang] = useState(type.calendar_language || 'Academic year')
  const [hasCalendar, setHasCalendar] = useState(type.has_academic_calendar ?? true)
  const [levels, setLevels] = useState<TypeLevel[]>(Array.isArray(type.levels) ? type.levels : [])
  const [newLevel, setNewLevel] = useState('')
  const [saving, setSaving] = useState(false)

  function addLevel() {
    const label = newLevel.trim()
    if (!label) return
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 28)
    if (levels.some(l => l.id === id)) { setNewLevel(''); return }
    setLevels(prev => [...prev, { id, label }])
    setNewLevel('')
  }

  const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }
  const input: React.CSSProperties = { height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--white)' }

  return (
    <div style={{ padding: '16px 20px', borderTop: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={fieldLabel}>Period word</label>
          <input value={periodLang} onChange={e => setPeriodLang(e.target.value)} style={{ ...input, width: 130 }} />
        </div>
        <div>
          <label style={fieldLabel}>Periods / year</label>
          <input type="number" min={1} max={12} value={periodCount} onChange={e => setPeriodCount(Number(e.target.value))} style={{ ...input, width: 70 }} />
        </div>
        <div>
          <label style={fieldLabel}>Level word</label>
          <input value={levelLang} onChange={e => setLevelLang(e.target.value)} placeholder="Grade / Year / Department" style={{ ...input, width: 150 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', height: 34 }}>
          <input type="checkbox" checked={hasCalendar} onChange={e => setHasCalendar(e.target.checked)} style={{ width: 15, height: 15 }} />
          <span style={{ fontSize: 12, color: 'var(--near-black)' }}>Has a calendar</span>
        </label>
        {hasCalendar && (
          <>
            <div>
              <label style={fieldLabel}>Calendar word</label>
              <input value={calendarLang} onChange={e => setCalendarLang(e.target.value)} placeholder="Academic year / Fiscal year" style={{ ...input, width: 170 }} />
            </div>
            <div>
              <label style={fieldLabel}>Year starts</label>
              <select value={startMonth === '' ? '' : String(startMonth)} onChange={e => setStartMonth(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...input, width: 150 }}>
                <option value="">September (default)</option>
                {MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      <label style={fieldLabel}>Levels</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: 4 }}>
        {levels.map(l => (
          <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 6px 0 11px', borderRadius: 8, background: 'var(--white)', border: '0.5px solid var(--border)', fontSize: 12, fontWeight: 500, color: 'var(--near-black)' }}>
            {l.label}
            <button onClick={() => setLevels(prev => prev.filter(x => x.id !== l.id))} aria-label={`Remove ${l.label}`} style={{ border: 'none', background: 'var(--bg2)', width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', padding: 0, fontSize: 10, color: 'var(--mid-grey)', fontFamily: 'inherit' }}>×</button>
          </span>
        ))}
        {levels.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No levels yet. Add the grades or years this type uses.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, maxWidth: 360, marginBottom: 16 }}>
        <input value={newLevel} onChange={e => setNewLevel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLevel() }} placeholder="e.g. Year 1, Grade 7" style={{ ...input, flex: 1, height: 36 }} />
        <button onClick={addLevel} disabled={!newLevel.trim()} style={{ height: 36, padding: '0 14px', borderRadius: 7, border: 'none', background: 'var(--near-black)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={async () => {
            setSaving(true)
            await onSave({ ...type, period_language: periodLang, period_count: periodCount, academic_year_start_month: startMonth === '' ? null : startMonth, level_language: levelLang, calendar_language: calendarLang, has_academic_calendar: hasCalendar, levels })
            setSaving(false)
          }}
          disabled={saving}
          style={{ height: 34, padding: '0 18px', borderRadius: 7, border: 'none', background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}
        >{saving ? 'Saving...' : 'Save type'}</button>
        <button onClick={onCancel} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--mid-grey)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
