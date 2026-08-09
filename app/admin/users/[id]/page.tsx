'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { USER_WITH_INSTITUTION_NAME_ID } from '@/lib/supabase-embeds'
import { applyPlanUpgrade } from '@/lib/plan-upgrade'
import type { CreationUsage, SubscriptionTier } from '@/lib/types'

interface CreditAcctRow {
  allowance_balance: number
  purchased_balance: number
  lifetime_used: number
}

interface AiUsageRow {
  generations_used: number
  generations_all_time: number
  monthly_limit: number | null
  last_generated_at: string | null
}

interface UserDetail {
  id: string
  name: string
  email: string
  role: string
  subscription_tier?: string
  institution_id?: string
  user_level?: string
  level_type?: string
  creator_slug?: string
  is_sphere_staff?: boolean
  created_at: string
  institutions?: { name: string; id: string }
}

const TIERS = ['membership', 'creator_quarterly', 'creator_marketplace', 'institution']
const TIER_COLOR: Record<string, string> = {
  institution: '#1A8966',
  creator_marketplace: '#2E2886',
  creator_quarterly: '#D97010',
  membership: '#A09DA8',
}

export default function UserDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const [user, setUser] = useState<UserDetail | null>(null)
  const [usage, setUsage] = useState<CreationUsage | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsageRow | null>(null)
  const [creditAcct, setCreditAcct] = useState<CreditAcctRow | null>(null)
  const [creditMsg, setCreditMsg] = useState('')
  const [addOns, setAddOns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTier, setSelectedTier] = useState('membership')
  const [savingTier, setSavingTier] = useState(false)
  const [tierMsg, setTierMsg] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [suspending, setSuspending] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase
        .from('users')
        .select(USER_WITH_INSTITUTION_NAME_ID)
        .eq('id', id)
        .maybeSingle()

      if (!u) { setLoading(false); return }
      setUser(u as UserDetail)
      setSelectedTier((u as UserDetail).subscription_tier ?? 'membership')

      const { data: usageRow } = await supabase.from('creation_usage').select('*').eq('user_id', id).maybeSingle()
      setUsage(usageRow as CreationUsage | null)

      // Degrades quietly before the metering migration runs.
      const { data: aiRow } = await supabase
        .from('ai_generation_usage')
        .select('generations_used, generations_all_time, monthly_limit, last_generated_at')
        .eq('user_id', id)
        .maybeSingle()
      setAiUsage((aiRow as AiUsageRow | null) ?? null)

      const { data: creditRow } = await supabase
        .from('ai_credit_accounts')
        .select('allowance_balance, purchased_balance, lifetime_used')
        .eq('owner_type', 'user')
        .eq('owner_id', id)
        .maybeSingle()
      setCreditAcct((creditRow as CreditAcctRow | null) ?? null)

      const { data: addOnRows } = await supabase.from('user_add_ons').select('add_on_id').eq('user_id', id).eq('status', 'active')
      setAddOns((addOnRows ?? []).map((r: { add_on_id: string }) => r.add_on_id))

      setLoading(false)
    }
    load()
  }, [id])

  async function saveTier() {
    setSavingTier(true)
    const tier = selectedTier as SubscriptionTier
    const result = await applyPlanUpgrade(id, tier, { resetUsed: false, client: supabase })
    setSavingTier(false)
    if (!result.ok) {
      setTierMsg(result.error)
      setTimeout(() => setTierMsg(''), 4000)
      return
    }
    setUser(prev => prev ? { ...prev, subscription_tier: tier } : prev)
    const { data: usageRow } = await supabase.from('creation_usage').select('*').eq('user_id', id).maybeSingle()
    setUsage(usageRow as CreationUsage | null)
    setTierMsg('Plan updated.')
    setTimeout(() => setTierMsg(''), 3000)
  }

  async function resetQuota() {
    if (!usage) return
    setResetting(true)
    await supabase.from('creation_usage').update({
      assess_used: 0,
      engage_used: 0,
      learn_used: 0,
      train_used: 0,
    }).eq('user_id', id)
    setUsage(prev => prev ? { ...prev, assess_used: 0, engage_used: 0, learn_used: 0, train_used: 0 } : prev)
    setResetting(false)
    setResetMsg('Quota reset to 0.')
    setTimeout(() => setResetMsg(''), 3000)
  }

  if (loading) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p></div>
  if (!user) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>User not found.</p></div>

  const currentTierColor = TIER_COLOR[user.subscription_tier ?? 'membership'] ?? '#A09DA8'

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 800 }}>
      <Link href="/admin/users" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 20 }}>
        ← All users
      </Link>

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: currentTierColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>{user.name}</p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 2 }}>
            {user.email}
            {user.institutions && <span> · <Link href={`/admin/institutions/${user.institution_id}`} style={{ color: 'var(--amber)', textDecoration: 'none' }}>{user.institutions.name}</Link></span>}
          </p>
        </div>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: currentTierColor, background: `${currentTierColor}15`,
          padding: '5px 12px', borderRadius: 20,
        }}>{user.subscription_tier ?? 'membership'}</span>
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Role', value: user.role },
          { label: 'Level', value: user.user_level ? `${user.user_level} (${user.level_type})` : 'Not set' },
          { label: 'Creator slug', value: user.creator_slug ? `/${user.creator_slug}` : 'None' },
          { label: 'Staff', value: user.is_sphere_staff ? 'Yes' : 'No' },
          { label: 'Joined', value: new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--white)', borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>{item.label}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Subscription tier override */}
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 14 }}>Change subscription plan</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {TIERS.map(t => (
            <button key={t} onClick={() => setSelectedTier(t)} style={{
              height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
              background: selectedTier === t ? 'var(--amber)' : 'var(--bg2)',
              color: selectedTier === t ? '#fff' : 'var(--mid-grey)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={saveTier} disabled={savingTier || selectedTier === user.subscription_tier} style={{
            height: 34, padding: '0 18px', borderRadius: 7, border: 'none',
            background: selectedTier === user.subscription_tier ? 'var(--bg2)' : 'var(--amber)',
            color: selectedTier === user.subscription_tier ? 'var(--mid-grey)' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: selectedTier === user.subscription_tier ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}>{savingTier ? 'Saving...' : 'Apply plan change'}</button>
          {tierMsg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{tierMsg}</p>}
        </div>
      </div>

      {/* AI credits — grant, comp, or refund. */}
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 3 }}>AI credits</p>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
              {creditAcct
                ? `${creditAcct.allowance_balance + creditAcct.purchased_balance} available · ${creditAcct.allowance_balance} included, ${creditAcct.purchased_balance} bought · ${creditAcct.lifetime_used} used all time`
                : 'No credit account yet. It opens on their first generation.'}
            </p>
            {creditMsg && <p style={{ fontSize: 12, color: 'var(--teal)', marginTop: 4 }}>{creditMsg}</p>}
          </div>
          <button
            onClick={async () => {
              const raw = window.prompt('How many credits to add?')
              if (raw == null) return
              const amount = Number(raw)
              if (!Number.isFinite(amount) || amount <= 0) return
              const reason = window.prompt('Reason (shown in their credit history)') ?? ''
              const res = await fetch('/api/admin/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerType: 'user', ownerId: id, amount, reason }),
              })
              const data = await res.json().catch(() => null)
              if (!res.ok) { setCreditMsg(data?.error ?? 'That did not save.'); return }
              setCreditAcct(prev =>
                prev
                  ? { ...prev, purchased_balance: prev.purchased_balance + amount }
                  : { allowance_balance: 0, purchased_balance: amount, lifetime_used: 0 }
              )
              setCreditMsg(`Added ${amount} credits.`)
            }}
            style={{
              height: 30, padding: '0 14px', borderRadius: 20, border: 'none',
              background: 'var(--bg2)', color: 'var(--mid-grey)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Add credits
          </button>
        </div>
      </div>

      {/* AI generation usage — bounds runaway usage and shows the trend. */}
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 3 }}>AI generations</p>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
              {aiUsage
                ? `${aiUsage.generations_used} this month${aiUsage.monthly_limit ? ` of ${aiUsage.monthly_limit} (custom cap)` : ''} · ${aiUsage.generations_all_time} all time`
                : 'No AI generations yet.'}
            </p>
            {aiUsage?.last_generated_at && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Last used {new Date(aiUsage.last_generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={async () => {
              const raw = window.prompt('Monthly AI generation cap for this user (blank uses the platform default)', aiUsage?.monthly_limit ? String(aiUsage.monthly_limit) : '')
              if (raw == null) return
              const value = raw.trim() === '' ? null : Number(raw)
              if (value !== null && (!Number.isFinite(value) || value <= 0)) return
              await supabase.from('ai_generation_usage').upsert(
                { user_id: id, monthly_limit: value },
                { onConflict: 'user_id' }
              )
              setAiUsage(prev => (prev ? { ...prev, monthly_limit: value } : prev))
            }}
            style={{
              height: 30, padding: '0 14px', borderRadius: 20, border: 'none',
              background: 'var(--bg2)', color: 'var(--mid-grey)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Set cap
          </button>
        </div>
      </div>

      {/* Creation usage */}
      {usage && (
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Creation usage</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {resetMsg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{resetMsg}</p>}
              <button onClick={resetQuota} disabled={resetting} style={{
                height: 30, padding: '0 14px', borderRadius: 20, border: 'none',
                background: 'var(--bg2)', color: 'var(--mid-grey)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{resetting ? 'Resetting...' : 'Reset usage to 0'}</button>
            </div>
          </div>
          <div className="r-collapse-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {(['assess', 'engage', 'learn', 'train'] as const).map(mod => {
              const used = usage[`${mod}_used` as keyof CreationUsage] as number
              const quota = usage[`${mod}_quota` as keyof CreationUsage] as number
              const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0
              const colors: Record<string, string> = { assess: '#C23B2A', engage: '#D97010', learn: '#1A8966', train: '#1052A3' }
              return (
                <div key={mod}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors[mod] }}>{mod}</span>
                    <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{used}/{quota}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: colors[mod], borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {addOns.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 7 }}>Active add-ons</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {addOns.map(a => (
                  <span key={a} style={{ fontSize: 11, fontWeight: 600, background: 'var(--teal-light)', color: 'var(--teal)', padding: '3px 10px', borderRadius: 20 }}>{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Staff toggle */}
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10 }}>Staff access</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={async () => {
              setSuspending(true)
              await supabase.from('users').update({ is_sphere_staff: !user.is_sphere_staff }).eq('id', id)
              setUser(prev => prev ? { ...prev, is_sphere_staff: !prev.is_sphere_staff } : prev)
              setSuspending(false)
            }}
            disabled={suspending}
            style={{
              height: 34, padding: '0 18px', borderRadius: 7, border: 'none',
              background: user.is_sphere_staff ? 'var(--coral)' : 'var(--teal)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {user.is_sphere_staff ? 'Remove staff access' : 'Grant staff access'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
            {user.is_sphere_staff ? 'This user can access the admin panel.' : 'This user has no admin access.'}
          </p>
        </div>
      </div>
    </div>
  )
}
