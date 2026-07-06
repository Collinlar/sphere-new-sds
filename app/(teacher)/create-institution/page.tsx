'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { setActiveContext, loadMemberships } from '@/lib/context'

interface InstitutionType {
  id: string
  name: string
}

export default function CreateInstitutionPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<InstitutionType[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('institution_types')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTypes((data ?? []) as InstitutionType[]))
  }, [])

  async function handleCreate() {
    if (!name.trim()) { setError("What's your institution called?"); return }
    if (!typeId) { setError('Pick your institution type. It sets up your levels and calendar.'); return }

    setCreating(true)
    setError('')

    const user = getCurrentUser()

    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .insert({
        name: name.trim(),
        city: city.trim() || null,
        type: typeId,
        institution_type_id: typeId,
        owner_user_id: user.id,
        subscription_plan: 'institution',
        modules: ['engage', 'assess', 'learn', 'train'],
      })
      .select('id, name')
      .single()

    if (instError || !institution) {
      setError(`Your institution did not save. ${instError?.message ?? 'Try again.'}`)
      setCreating(false)
      return
    }

    const { error: memberError } = await supabase.from('institution_members').insert({
      institution_id: institution.id,
      user_id: user.id,
      member_role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    if (memberError) {
      setError('Your institution was created but your ownership did not register. Contact support.')
      setCreating(false)
      return
    }

    await loadMemberships(user.id)
    setActiveContext({
      type: 'institution',
      institutionId: institution.id,
      institutionName: institution.name,
      memberRole: 'owner',
    })

    router.push('/platform/settings')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--white)',
    fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Create an institution" />

      <div style={{ padding: '28px 32px 60px', maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Set up your institution</h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24, lineHeight: 1.6 }}>
          You become the owner. Your personal account and everything on it stays yours. You can switch between your personal workspace and the institution any time.
        </p>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>{error}</p>
        )}

        <div className="sphere-card">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
            Institution name
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="What's your institution called?"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
            City
          </label>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="Which city are you based in?"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 8 }}>
            Institution type
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            This sets up your levels, period language, and academic calendar automatically.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {types.map(t => {
              const isActive = typeId === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => { setTypeId(t.id); setError('') }}
                  style={{
                    padding: '11px 12px', borderRadius: 8, textAlign: 'left',
                    border: isActive ? '1.5px solid #2E2886' : '1.5px solid var(--border)',
                    background: isActive ? '#EEEDF8' : 'var(--white)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#2E2886' : 'var(--near-black)',
                  }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              width: '100%', height: 48, borderRadius: 8, border: 'none',
              background: '#2E2886', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: creating ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {creating ? 'Setting up your institution...' : 'Create my institution'}
          </button>
        </div>
      </div>
    </div>
  )
}
