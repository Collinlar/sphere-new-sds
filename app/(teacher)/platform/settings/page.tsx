'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, SPHERE_PLAN_CHANGE_EVENT } from '@/lib/auth'
import {
  type ModuleKey,
  getEffectiveModules,
  getPlanIncludedModules,
  getPlanModuleDescription,
  parseInstitutionModules,
} from '@/lib/institution-modules'
import { fetchInstitutionTypeByInstitutionId } from '@/lib/institution-type'
import { formatInstitutionCalendar } from '@/lib/institution-periods'
import { getEffectivePlanId, getCreationUsage } from '@/lib/subscription'
import { PLAN_PRIVILEGE_SUMMARY } from '@/lib/plan-privileges'
import type { CreationUsage, SubscriptionTier } from '@/lib/types'

const MODULE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  engage: { label: 'Engage', color: '#D97010', bg: '#FEF0DC', desc: 'Live quiz and game-based learning' },
  assess: { label: 'Assess', color: '#C23B2A', bg: '#FDECEA', desc: 'Formal examinations and assessments' },
  learn:  { label: 'Learn',  color: '#1A8966', bg: '#DDFAF0', desc: 'Structured course delivery and LMS' },
  train:  { label: 'Train',  color: '#1052A3', bg: '#E3EDFB', desc: 'Compliance and skills training paths' },
}

const PLAN_LABEL: Record<string, string> = {
  membership: 'Membership',
  trial: 'Membership',
  creator_quarterly: 'Creator Quarterly',
  creator_marketplace: 'Creator Marketplace',
  institution: 'Institution',
}

interface InstitutionType {
  id: string
  name: string
}

export default function PlatformSettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [personalPlan, setPersonalPlan] = useState<SubscriptionTier>('membership')
  const [personalUsage, setPersonalUsage] = useState<CreationUsage | null>(null)
  const [isPersonalAccount, setIsPersonalAccount] = useState(true)

  const [institutionName, setInstitutionName] = useState('')
  const [institutionTypeId, setInstitutionTypeId] = useState('')
  const [institutionTypes, setInstitutionTypes] = useState<InstitutionType[]>([])
  const [provisionedModules, setProvisionedModules] = useState<ModuleKey[]>([])
  const [effectiveModules, setEffectiveModules] = useState<ModuleKey[]>([])
  const [subscriptionPlan, setSubscriptionPlan] = useState('membership')
  const [institutionId, setInstitutionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [currentPeriod, setCurrentPeriod] = useState('')

  async function loadPersonalPlan() {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    if (!uid) return

    const [tier, usage] = await Promise.all([
      getEffectivePlanId(uid),
      getCreationUsage(uid),
    ])
    setPersonalPlan(tier)
    setPersonalUsage(usage)
    setEffectiveModules(getPlanIncludedModules(tier))
  }

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      setDisplayName(user.name ?? '')
      setAdminEmail(user.email ?? '')

      const { data: types } = await supabase
        .from('institution_types')
        .select('id, name')
        .order('name')
      setInstitutionTypes((types ?? []) as InstitutionType[])

      await loadPersonalPlan()

      const iid = user.institution_id
      setInstitutionId(iid ?? '')
      setIsPersonalAccount(!iid)

      if (!iid) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('institutions')
        .select('name, institution_type_id, modules, subscription_plan')
        .eq('id', iid)
        .single()

      if (data) {
        setInstitutionName(data.name ?? '')
        setInstitutionTypeId(data.institution_type_id ?? '')
        const plan = data.subscription_plan === 'trial' ? 'membership' : (data.subscription_plan ?? 'membership')
        setSubscriptionPlan(plan)

        const provisioned = parseInstitutionModules(data.modules)
        setProvisionedModules(provisioned)
        setEffectiveModules(getEffectiveModules(provisioned, plan))
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => {
      loadPersonalPlan()
    }
    window.addEventListener(SPHERE_PLAN_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(SPHERE_PLAN_CHANGE_EVENT, refresh)
  }, [])

  useEffect(() => {
    async function loadCalendar() {
      if (!institutionId || !institutionTypeId) {
        setAcademicYear('')
        setCurrentPeriod('')
        return
      }
      const type = await fetchInstitutionTypeByInstitutionId(institutionId)
      if (!type) return
      const calendar = formatInstitutionCalendar(type)
      setAcademicYear(calendar.academicYear)
      setCurrentPeriod(calendar.currentPeriod)
    }
    loadCalendar()
  }, [institutionId, institutionTypeId])

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

  const activePlanId = isPersonalAccount ? personalPlan : subscriptionPlan
  const planLabel = PLAN_LABEL[activePlanId] ?? activePlanId
  const isPaidPlan = activePlanId !== 'membership'
  const planModules = isPersonalAccount
    ? getPlanIncludedModules(personalPlan)
    : effectiveModules

  const poolUsed = personalUsage
    ? personalUsage.assess_used + personalUsage.engage_used + personalUsage.learn_used + personalUsage.train_used
    : 0
  const poolTotal = personalUsage
    ? personalUsage.assess_quota + personalUsage.engage_quota + personalUsage.learn_quota + personalUsage.train_quota
    : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Settings"
        right={
          !isPersonalAccount ? (
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
          ) : undefined
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 860 }}>
        {loading ? (
          <div style={{ fontSize: 14, color: 'var(--mid-grey)', padding: '40px 0' }}>
            Loading your settings...
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
              {isPersonalAccount ? 'Account settings' : 'Institution settings'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 28 }}>
              {isPersonalAccount
                ? `${displayName} · ${planLabel}`
                : `${institutionName} · ${planLabel}`}
            </p>

            {error && (
              <div style={{ background: '#FDECEA', border: '1px solid #C23B2A', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#C23B2A' }}>
                {error}
              </div>
            )}

            {isPersonalAccount && (
              <div className="sphere-card" style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Your profile</h2>
                <div className="r-collapse-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>Name</label>
                    <input value={displayName} disabled style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, color: 'var(--mid-grey)', opacity: 0.85, boxSizing: 'border-box',
                    }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>Email</label>
                    <input value={adminEmail} disabled style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, color: 'var(--mid-grey)', opacity: 0.85, boxSizing: 'border-box',
                    }} />
                  </div>
                </div>
              </div>
            )}

            {!isPersonalAccount && (
              <div className="sphere-card" style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Institution profile</h2>
                <div className="r-collapse-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                      }}
                    >
                      <option value="">Select a type...</option>
                      {institutionTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {academicYear && (
                      <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 8, lineHeight: 1.5 }}>
                        Academic year {academicYear} · Current {currentPeriod.toLowerCase()}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                      Admin email
                    </label>
                    <input value={adminEmail} disabled style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
                      border: '1px solid transparent', background: 'var(--bg2)',
                      fontSize: 14, color: 'var(--mid-grey)', opacity: 0.6, boxSizing: 'border-box',
                    }} />
                  </div>
                </div>
              </div>
            )}

            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
                    {isPersonalAccount ? 'Your modules' : 'Active modules'}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                    {planModules.length} of 4 modules on your {planLabel} plan.
                    {!isPersonalAccount && provisionedModules.length > effectiveModules.length && (
                      <> {provisionedModules.length - effectiveModules.length} provisioned module{provisionedModules.length - effectiveModules.length !== 1 ? 's' : ''} need a plan upgrade.</>
                    )}
                  </p>
                </div>
                {!isPersonalAccount && (
                  <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    Managed by Sphere
                  </span>
                )}
              </div>
              <div className="r-collapse-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['engage', 'assess', 'learn', 'train'] as const).map(key => {
                  const m = MODULE_META[key]
                  const isAccessible = planModules.includes(key)
                  const isProvisioned = !isPersonalAccount && provisionedModules.includes(key)
                  const statusLabel = isAccessible ? 'Active' : isProvisioned ? 'Upgrade' : 'Off'
                  const statusColor = isAccessible ? m.color : isProvisioned ? '#2E2886' : 'var(--mid-grey)'
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        border: isAccessible ? `1.5px solid ${m.color}` : '1.5px solid var(--border)',
                        background: isAccessible ? m.bg : 'var(--white)',
                        opacity: isAccessible ? 1 : isProvisioned ? 0.85 : 0.45,
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isAccessible ? m.color : 'var(--mid-grey)',
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isAccessible ? m.color : 'var(--near-black)' }}>{m.label}</p>
                        <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 1 }}>{m.desc}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="sphere-card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Subscription</h2>
              {isPaidPlan && (
                <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 16 }}>Billed via MTN MoMo or card through Paystack</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, marginBottom: 14, marginTop: isPaidPlan ? 0 : 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{planLabel}</p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>
                    {getPlanModuleDescription(activePlanId)}
                  </p>
                  {isPersonalAccount && personalPlan === 'creator_quarterly' && personalUsage && poolTotal > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 6 }}>
                      Creation pool: {poolUsed} used of {poolTotal} allocated this period
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2E2886', background: '#EEEDF8', border: '1px solid #C5C3EC', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current
                </span>
              </div>
              {isPersonalAccount && isPaidPlan && (
                <ul style={{ margin: '0 0 14px 0', paddingLeft: 18, fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.7 }}>
                  {(PLAN_PRIVILEGE_SUMMARY[personalPlan] ?? []).slice(0, 4).map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
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
