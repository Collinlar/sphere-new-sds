'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LevelItem { id: string; label: string }
interface TypeOption { id: string; name: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Institution academic flexibility: calendar start month override,
// borrowed level groups from other institution types, and custom levels.
export default function AcademicSetupCard({ institutionId }: { institutionId: string }) {
  const [startMonth, setStartMonth] = useState<number | ''>('')
  const [typeDefaultMonth, setTypeDefaultMonth] = useState(9)
  const [hasCalendar, setHasCalendar] = useState(true)
  const [levelWord, setLevelWord] = useState('Level')
  const [calendarWord, setCalendarWord] = useState('Academic year')
  const [primaryTypeId, setPrimaryTypeId] = useState('')
  const [extraTypeIds, setExtraTypeIds] = useState<string[]>([])
  const [customLevels, setCustomLevels] = useState<LevelItem[]>([])
  const [allTypes, setAllTypes] = useState<TypeOption[]>([])
  const [newLevel, setNewLevel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: inst }, { data: types }] = await Promise.all([
        supabase
          .from('institutions')
          .select('institution_type_id, academic_year_start_month, custom_levels, extra_level_type_ids, institution_types(academic_year_start_month, level_language, calendar_language, has_academic_calendar)')
          .eq('id', institutionId)
          .maybeSingle(),
        supabase.from('institution_types').select('id, name').eq('is_custom', false).order('name'),
      ])
      if (inst) {
        setPrimaryTypeId((inst.institution_type_id as string) ?? '')
        setStartMonth((inst.academic_year_start_month as number | null) ?? '')
        const typeRow = (inst as unknown as { institution_types?: { academic_year_start_month?: number; level_language?: string; calendar_language?: string; has_academic_calendar?: boolean } }).institution_types
        setTypeDefaultMonth(typeRow?.academic_year_start_month ?? 9)
        setHasCalendar(typeRow?.has_academic_calendar ?? true)
        setLevelWord(typeRow?.level_language || 'Level')
        setCalendarWord(typeRow?.calendar_language || 'Academic year')
        setExtraTypeIds(((inst.extra_level_type_ids ?? []) as string[]))
        setCustomLevels(Array.isArray(inst.custom_levels) ? (inst.custom_levels as LevelItem[]) : [])
      }
      setAllTypes((types ?? []) as TypeOption[])
      setLoading(false)
    }
    load()
  }, [institutionId])

  async function save(patch: Record<string, unknown>) {
    setSaving(true)
    const { error } = await supabase.from('institutions').update(patch).eq('id', institutionId)
    setSaving(false)
    setMsg(error ? 'That change did not save. Try again.' : 'Saved.')
    setTimeout(() => setMsg(''), 2500)
  }

  function toggleExtraType(id: string) {
    const next = extraTypeIds.includes(id) ? extraTypeIds.filter(t => t !== id) : [...extraTypeIds, id]
    setExtraTypeIds(next)
    save({ extra_level_type_ids: next })
  }

  function addCustomLevel() {
    const label = newLevel.trim()
    if (!label) return
    const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`
    if (customLevels.some(l => l.id === id)) { setNewLevel(''); return }
    const next = [...customLevels, { id, label }]
    setCustomLevels(next)
    setNewLevel('')
    save({ custom_levels: next })
  }

  function removeCustomLevel(id: string) {
    const next = customLevels.filter(l => l.id !== id)
    setCustomLevels(next)
    save({ custom_levels: next })
  }

  if (loading) return null

  return (
    <div className="sphere-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{hasCalendar ? 'Academic setup' : 'Structure setup'}</h2>
        {msg && <p style={{ fontSize: 12, color: msg === 'Saved.' ? 'var(--teal)' : 'var(--coral)' }}>{msg}</p>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 18 }}>
        Your {levelWord.toLowerCase()}s{hasCalendar ? ' and calendar come' : ' come'} from your institution type. Adjust them here to match how you actually run.
      </p>

      {/* Calendar start month — only for types that keep a calendar. */}
      {hasCalendar && (
        <>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
            {calendarWord} starts in
          </label>
          <select
            value={startMonth === '' ? '' : String(startMonth)}
            onChange={e => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setStartMonth(v ?? '')
              save({ academic_year_start_month: v })
            }}
            disabled={saving}
            style={{ width: 260, maxWidth: '100%', height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', fontSize: 14, fontFamily: 'inherit', color: 'var(--near-black)', marginBottom: 20 }}
          >
            <option value="">{MONTHS[typeDefaultMonth - 1]} (your type&apos;s default)</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </>
      )}

      {/* Extra level groups */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
        Additional {levelWord.toLowerCase()} groups
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
        Running more than one kind of programme? Enable another type&apos;s {levelWord.toLowerCase()}s alongside your own.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {allTypes.filter(t => t.id !== primaryTypeId).map(t => {
          const on = extraTypeIds.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => toggleExtraType(t.id)}
              disabled={saving}
              style={{
                height: 32, padding: '0 13px', borderRadius: 8, border: 'none',
                background: on ? 'var(--violet-light)' : 'var(--bg2)',
                color: on ? 'var(--violet)' : 'var(--mid-grey)',
                fontSize: 12, fontWeight: on ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.name}
            </button>
          )
        })}
      </div>

      {/* Custom levels */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
        Custom {levelWord.toLowerCase()}s
      </label>
      {customLevels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {customLevels.map(l => (
            <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 8px 0 12px', borderRadius: 8, background: 'var(--teal-light)', color: 'var(--teal-dark, #085041)', fontSize: 12, fontWeight: 600 }}>
              {l.label}
              <button onClick={() => removeCustomLevel(l.id)} aria-label={`Remove ${l.label}`} style={{ border: 'none', background: 'rgba(0,0,0,0.08)', width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', padding: 0, fontSize: 10, color: 'inherit', fontFamily: 'inherit' }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, maxWidth: 380 }}>
        <input
          value={newLevel}
          onChange={e => setNewLevel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCustomLevel() }}
          placeholder="e.g. Remedial, Diploma Year 1"
          style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={addCustomLevel} disabled={saving || !newLevel.trim()} style={{ height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--near-black)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add level
        </button>
      </div>
    </div>
  )
}
