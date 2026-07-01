'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'active' | 'addons' | 'plans'

interface SubUser {
  id: string
  name: string
  email: string
  subscription_tier: string
  created_at: string
}

interface AddOnRow {
  id: string
  user_id: string
  add_on_id: string
  status: string
  started_at?: string
  expires_at?: string
  users?: { name: string; email: string }
}

interface Plan {
  id: string
  name: string
  price_ghs?: number
  billing_period?: string
  assess_quota?: number
  engage_quota?: number
  learn_quota?: number
  train_quota?: number
  total_creation_pool?: number
  session_student_cap?: number
  enrolled_student_cap?: number
  marketplace_commission_rate?: number
}

const TIER_COLOR: Record<string, string> = {
  institution: '#1A8966',
  creator_marketplace: '#2E2886',
  creator_quarterly: '#D97010',
  membership: '#A09DA8',
}

const ALL_TIERS = ['all', 'membership', 'creator_quarterly', 'creator_marketplace', 'institution']

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('active')
  const [users, setUsers] = useState<SubUser[]>([])
  const [addOns, setAddOns] = useState<AddOnRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState('all')
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [planMsg, setPlanMsg] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: userData }, { data: addOnData }, { data: planData }] = await Promise.all([
        supabase.from('users').select('id, name, email, subscription_tier, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('user_add_ons').select('*, users(name, email)').order('started_at', { ascending: false }),
        supabase.from('subscription_plans').select('*'),
      ])
      setUsers((userData ?? []) as SubUser[])
      setAddOns((addOnData ?? []) as AddOnRow[])
      setPlans((planData ?? []) as Plan[])
      setLoading(false)
    }
    load()
  }, [])

  const filteredUsers = tierFilter === 'all' ? users : users.filter(u => u.subscription_tier === tierFilter)

  async function grantAddOn(userId: string, addOnId: string) {
    await supabase.from('user_add_ons').upsert({ user_id: userId, add_on_id: addOnId, status: 'active', started_at: new Date().toISOString() })
    setPlanMsg(`Add-on granted to user.`)
    setTimeout(() => setPlanMsg(''), 3000)
  }

  async function savePlan(plan: Plan) {
    setSavingPlan(plan.id)
    await supabase.from('subscription_plans').update({
      assess_quota: plan.assess_quota,
      engage_quota: plan.engage_quota,
      learn_quota: plan.learn_quota,
      train_quota: plan.train_quota,
      total_creation_pool: plan.total_creation_pool,
      session_student_cap: plan.session_student_cap,
      enrolled_student_cap: plan.enrolled_student_cap,
      marketplace_commission_rate: plan.marketplace_commission_rate,
    }).eq('id', plan.id)
    setSavingPlan(null)
    setPlanMsg(`${plan.name} updated. Changes apply to new signups only.`)
    setTimeout(() => setPlanMsg(''), 4000)
  }

  const tiers = ['membership', 'creator_quarterly', 'creator_marketplace', 'institution']
  const tierCounts = tiers.map(t => ({ tier: t, count: users.filter(u => u.subscription_tier === t).length }))

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Subscriptions</p>
        </div>
        {planMsg && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', padding: '7px 14px', borderRadius: 20 }}>{planMsg}</p>}
      </div>

      {/* Tier summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {tierCounts.map(({ tier, count }) => (
          <div key={tier} style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-soft)', borderTop: `2px solid ${TIER_COLOR[tier]}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TIER_COLOR[tier], marginBottom: 6 }}>{tier}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--near-black)' }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {([
          { key: 'active', label: 'Active subscriptions' },
          { key: 'addons', label: 'Add-ons' },
          { key: 'plans', label: 'Plan editor' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            height: 36, padding: '0 18px', borderRadius: 20, border: 'none',
            background: tab === t.key ? 'var(--near-black)' : 'var(--white)',
            color: tab === t.key ? '#fff' : 'var(--mid-grey)',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p>}

      {/* ACTIVE SUBSCRIPTIONS */}
      {!loading && tab === 'active' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ALL_TIERS.map(t => (
              <button key={t} onClick={() => setTierFilter(t)} style={{
                height: 30, padding: '0 12px', borderRadius: 20, border: 'none',
                background: tierFilter === t ? 'var(--near-black)' : 'var(--white)',
                color: tierFilter === t ? '#fff' : 'var(--mid-grey)',
                fontSize: 12, fontWeight: tierFilter === t ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
              }}>{t === 'all' ? 'All' : t}</button>
            ))}
          </div>
          <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Name', 'Email', 'Plan', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => {
                  const tc = TIER_COLOR[u.subscription_tier] ?? '#A09DA8'
                  return (
                    <tr key={u.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{u.name}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{u.email}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tc, background: `${tc}15`, padding: '3px 8px', borderRadius: 20 }}>{u.subscription_tier}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && <tr><td colSpan={4} style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No users on this plan.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD-ONS */}
      {!loading && tab === 'addons' && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['User', 'Add-on', 'Status', 'Started', 'Expires'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addOns.map((a, i) => (
                <tr key={a.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{(a as { users?: { name: string } }).users?.name ?? '—'}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(a as { users?: { email: string } }).users?.email ?? ''}</p>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--near-black)' }}>{a.add_on_id}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: a.status === 'active' ? 'var(--teal)' : 'var(--mid-grey)', background: a.status === 'active' ? 'var(--teal-light)' : 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>{a.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>{a.started_at ? new Date(a.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>{a.expires_at ? new Date(a.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry'}</td>
                </tr>
              ))}
              {addOns.length === 0 && <tr><td colSpan={5} style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No add-ons in use.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* PLAN EDITOR */}
      {!loading && tab === 'plans' && (
        <div>
          <div style={{ background: '#FFF8ED', border: '0.5px solid #D97010', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#7A4A00', lineHeight: 1.6 }}>
              Changes here affect quotas and caps for new signups only. Existing users keep their current allocation until you manually update them via the Users panel.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plans.map(plan => (
              <PlanEditorCard key={plan.id} plan={plan} saving={savingPlan === plan.id} onSave={updated => savePlan(updated)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PlanEditorCard({ plan, saving, onSave }: { plan: Plan; saving: boolean; onSave: (p: Plan) => void }) {
  const [local, setLocal] = useState(plan)

  function field(key: keyof Plan, label: string) {
    const val = local[key]
    return (
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>{label}</label>
        <input
          type="number"
          value={val as number ?? ''}
          onChange={e => setLocal(prev => ({ ...prev, [key]: Number(e.target.value) || null }))}
          style={{ width: '100%', height: 34, border: '0.5px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--shadow-soft)' }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)', marginBottom: 16 }}>{plan.name}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
        {field('assess_quota', 'Assess quota')}
        {field('engage_quota', 'Engage quota')}
        {field('learn_quota', 'Learn quota')}
        {field('train_quota', 'Train quota')}
        {field('total_creation_pool', 'Creation pool')}
        {field('session_student_cap', 'Session cap')}
        {field('enrolled_student_cap', 'Enrolled cap')}
        {field('marketplace_commission_rate', 'Commission %')}
      </div>
      <button onClick={() => onSave(local)} disabled={saving} style={{
        height: 34, padding: '0 18px', borderRadius: 7, border: 'none',
        background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
      }}>{saving ? 'Saving...' : 'Save plan changes'}</button>
    </div>
  )
}
