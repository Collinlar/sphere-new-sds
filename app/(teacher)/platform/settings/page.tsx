'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

const MODULES = [
  { key: 'engage', label: 'Engage', desc: 'Live quiz and game-based learning', color: '#EF9F27', bg: '#FEF3DC' },
  { key: 'assess', label: 'Assess', desc: 'Formal examinations and assessments', color: '#E05C4B', bg: '#FDECEA' },
  { key: 'learn', label: 'Learn', desc: 'Structured course delivery and LMS', color: '#2BA888', bg: '#E1F5EE' },
  { key: 'train', label: 'Train', desc: 'Compliance and skills training paths', color: '#185FA5', bg: '#E6F1FB' },
]

type ModuleMap = Record<string, boolean>

export default function PlatformSettingsPage() {
  const [institutionName, setInstitutionName] = useState('')
  const [institutionType, setInstitutionType] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [modules, setModules] = useState<ModuleMap>({ engage: false, assess: false, learn: false, train: false })
  const [subscriptionPlan, setSubscriptionPlan] = useState('trial')
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

      if (!user.institution_id) { setLoading(false); return }

      const { data } = await supabase
        .from('institutions')
        .select('name, type, modules, subscription_plan')
        .eq('id', user.institution_id)
        .single()

      if (data) {
        setInstitutionName(data.name ?? '')
        setInstitutionType(data.type ?? '')
        setModules(data.modules ?? { engage: false, assess: false, learn: false, train: false })
        setSubscriptionPlan(data.subscription_plan ?? 'trial')
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleModule(key: string) {
    setModules(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  async function saveSettings() {
    if (!institutionId) return
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('institutions')
      .update({
        name: institutionName,
        type: institutionType,
        modules,
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

  const activeCount = Object.values(modules).filter(Boolean).length
  const planLabel = subscriptionPlan === 'trial' ? '14-day free trial' : subscriptionPlan

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
              background: saved ? '#2BA888' : '#36318F', color: '#fff',
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
              <div style={{ background: '#FDECEA', border: '1px solid #E05C4B', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#7A1A10' }}>
                {error}
              </div>
            )}

            {/* Institution profile */}
            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Institution profile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Institution name', value: institutionName, onChange: setInstitutionName, placeholder: "What's your institution called?" },
                  { label: 'Institution type', value: institutionType, onChange: setInstitutionType, placeholder: 'school, company, university...' },
                  { label: 'Admin email', value: adminEmail, onChange: () => {}, placeholder: 'Admin email address', disabled: true },
                ].map((f) => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      value={f.value}
                      onChange={e => f.onChange(e.target.value)}
                      placeholder={f.placeholder}
                      disabled={f.disabled}
                      style={{
                        width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                        border: '1px solid transparent', background: f.disabled ? 'var(--bg2)' : 'var(--bg2)',
                        fontSize: 14, fontFamily: 'var(--font)', color: f.disabled ? 'var(--mid-grey)' : 'var(--near-black)',
                        outline: 'none', opacity: f.disabled ? 0.6 : 1, boxSizing: 'border-box',
                      }}
                      onFocus={e => { if (!f.disabled) e.currentTarget.style.borderColor = '#36318F' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Module toggles */}
            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Active modules</h2>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 16 }}>
                {activeCount} of 4 modules active. Changes apply after saving.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {MODULES.map((m) => {
                  const isOn = !!modules[m.key]
                  return (
                    <div
                      key={m.key}
                      onClick={() => toggleModule(m.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                        border: isOn ? `1.5px solid ${m.color}` : '1.5px solid var(--border)',
                        background: isOn ? m.bg : 'var(--white)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: isOn ? m.color : 'var(--near-black)' }}>
                          {m.label}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>{m.desc}</p>
                      </div>
                      <div style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: isOn ? m.color : 'var(--border)',
                        position: 'relative', transition: 'background 0.15s', flexShrink: 0,
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3, left: isOn ? 21 : 3,
                          transition: 'left 0.15s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Subscription */}
            <div className="sphere-card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Subscription</h2>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 16 }}>Billed monthly via MTN MoMo or bank transfer</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', textTransform: 'capitalize' }}>{planLabel}</p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>{activeCount} module{activeCount !== 1 ? 's' : ''} active</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#36318F', background: '#EEEDF8', border: '1px solid #C5C3EC', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                To upgrade your plan or add seats, contact{' '}
                <a href="mailto:hello@spheresds.com" style={{ color: '#36318F', fontWeight: 500, textDecoration: 'none' }}>
                  hello@spheresds.com
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
