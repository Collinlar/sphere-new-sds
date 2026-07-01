'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

const MODULE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  engage: { label: 'Engage', color: '#D97010', bg: '#FEF0DC', desc: 'Live quiz and game-based learning' },
  assess: { label: 'Assess', color: '#C23B2A', bg: '#FDECEA', desc: 'Formal examinations and assessments' },
  learn:  { label: 'Learn',  color: '#1A8966', bg: '#DDFAF0', desc: 'Structured course delivery and LMS' },
  train:  { label: 'Train',  color: '#1052A3', bg: '#E3EDFB', desc: 'Compliance and skills training paths' },
}

const PLAN_LABEL: Record<string, string> = {
  membership: 'Membership',
  trial: 'Membership',       // legacy value — treated as membership
  creator_quarterly: 'Creator Quarterly',
  creator_marketplace: 'Creator Marketplace',
  institution: 'Institution',
}

interface InstitutionType {
  id: string
  name: string
}

export default function PlatformSettingsPage() {
  const [institutionName, setInstitutionName] = useState('')
  const [institutionTypeId, setInstitutionTypeId] = useState('')
  const [institutionTypes, setInstitutionTypes] = useState<InstitutionType[]>([])
  const [adminEmail, setAdminEmail] = useState('')
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [subscriptionPlan, setSubscriptionPlan] = useState('membership')
  const [institutionId, setInstitutionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      setAdminEmail(user.email ?? '')
      setInstitutionId(user.institution_id ?? '')

      // Load institution types for the dropdown
      const { data: types } = await supabase
        .from('institution_types')
        .select('id, name')
        .order('name')
      setInstitutionTypes((types ?? []) as InstitutionType[])

      if (!user.institution_id) { setLoading(false); return }

      const { data } = await supabase
        .from('institutions')
        .select('name, institution_type_id, modules, subscription_plan')
        .eq('id', user.institution_id)
        .single()

      if (data) {
        setInstitutionName(data.name ?? '')
        setInstitutionTypeId(data.institution_type_id ?? '')
        setSubscriptionPlan(data.subscription_plan ?? 'membership')

        // modules is stored as an array in the DB
        const raw = data.modules
        const parsed: string[] = Array.isArray(raw)
          ? raw
          : typeof raw === 'string'
            ? JSON.parse(raw)
            : typeof raw === 'object' && raw !== null
              // handle legacy boolean-map format {engage:true, assess:false}
              ? Object.entries(raw).filter(([, v]) => v).map(([k]) => k)
              : []
        setActiveModules(parsed)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveSettings() {
    if (!institutionId) return
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('institutions')
      .update({
        name: institutionName,
        institution_type_id: institutionTypeId || null,
      })
      .eq('id', institutionId)

    if (saveError) {
      setError('Changes did not save. Try again.')
    } else {
      localStorage.setItem('sphere_institution', institutionName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const planLabel = PLAN_LABEL[subscriptionPlan] ?? subscriptionPlan
  const isPaidPlan = subscriptionPlan !== 'membership'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Settings"
        right={
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            style={{
              height: 36, padding: '0 18px', borderRadius: 7, border: 'none',
              background: saved ? '#1A8966' : '#2E2886', color: '#fff',
              fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', opacity: loading ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
          </button>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 860 }}>
        {loading ? (
          <div style={{ fontSize: 14, color: 'var(--mid-grey)', padding: '40px 0' }}>
            Loading your settings...
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Institution settings</h1>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 28 }}>
              {institutionName} · {planLabel}
            </p>

            {error && (
              <div style={{ background: '#FDECEA', border: '1px solid #C23B2A', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#C23B2A' }}>
                {error}
              </div>
            )}

            {/* Institution profile */}
            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Institution profile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                    Institution name
                  </label>
                  <input
                    value={institutionName}
                    onChange={e => { setInstitutionName(e.target.value); setSaved(false) }}
                    placeholder="What's your institution called?"
                    style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, fontFamily: 'var(--font)', color: 'var(--near-black)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2E2886' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                  />
                </div>

                {/* Institution type — dropdown from DB */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                    Institution type
                  </label>
                  <select
                    value={institutionTypeId}
                    onChange={e => { setInstitutionTypeId(e.target.value); setSaved(false) }}
                    style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, fontFamily: 'var(--font)', color: institutionTypeId ? 'var(--near-black)' : 'var(--mid-grey)',
                      outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
                      appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%234B5563' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2E2886' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <option value="">Select a type...</option>
                    {institutionTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Admin email — read only */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                    Admin email
                  </label>
                  <input
                    value={adminEmail}
                    disabled
                    style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, fontFamily: 'var(--font)', color: 'var(--mid-grey)',
                      outline: 'none', opacity: 0.6, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Active modules — read only, set by Sphere Admin */}
            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Active modules</h2>
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                    {activeModules.length} of 4 modules active on your account.
                  </p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  Managed by Sphere
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['engage', 'assess', 'learn', 'train'] as const).map(key => {
                  const m = MODULE_META[key]
                  const isOn = activeModules.includes(key)
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        border: isOn ? `1.5px solid ${m.color}` : '1.5px solid var(--border)',
                        background: isOn ? m.bg : 'var(--white)',
                        opacity: isOn ? 1 : 0.45,
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isOn ? m.color : 'var(--mid-grey)',
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isOn ? m.color : 'var(--near-black)' }}>{m.label}</p>
                        <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 1 }}>{m.desc}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isOn ? m.color : 'var(--mid-grey)' }}>
                        {isOn ? 'Active' : 'Off'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {activeModules.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 10 }}>
                  No modules active yet. Contact <a href="mailto:hello@spheresds.com" style={{ color: '#2E2886', textDecoration: 'none' }}>hello@spheresds.com</a> to get set up.
                </p>
              )}
            </div>

            {/* Subscription */}
            <div className="sphere-card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Subscription</h2>
              {isPaidPlan && (
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 16 }}>Billed monthly via MTN MoMo or bank transfer</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, marginBottom: 14, marginTop: isPaidPlan ? 0 : 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{planLabel}</p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>
                    {subscriptionPlan === 'membership'
                      ? 'Free plan · 5 creations per module'
                      : `${activeModules.length} module${activeModules.length !== 1 ? 's' : ''} active`}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2E2886', background: '#EEEDF8', border: '1px solid #C5C3EC', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current
                </span>
              </div>
              <Link
                href="/platform/settings/billing"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#2E2886', textDecoration: 'none' }}
              >
                Manage plan and billing →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
