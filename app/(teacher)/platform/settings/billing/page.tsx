'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCreationUsage } from '@/lib/subscription'
import type { CreationUsage } from '@/lib/types'

const MODULE_COLOR = { assess: '#C23B2A', engage: '#D97010', learn: '#1A8966', train: '#1052A3' }
const MODULE_LABEL = { assess: 'Assess', engage: 'Engage', learn: 'Learn', train: 'Train' }
type Mod = keyof typeof MODULE_COLOR

const PLANS = [
  {
    id: 'membership',
    name: 'Membership',
    price: 'Free',
    period: '',
    description: 'Test the platform. Good for individuals exploring Sphere.',
    highlights: ['5 Assess creations', '5 Engage creations', 'Up to 5 students per session', 'No marketplace access'],
    accent: '#6B6870',
    cta: 'Current free plan',
  },
  {
    id: 'creator_quarterly',
    name: 'Creator Quarterly',
    price: 'GHS 300',
    period: '/quarter',
    description: 'For educators and trainers who create and sell resources.',
    highlights: ['40 creations — allocate across modules', 'Up to 50 students per session', 'Sell on the marketplace (15% commission)', 'Issue certificates'],
    accent: '#D97010',
    cta: 'Upgrade to Creator',
  },
  {
    id: 'creator_marketplace',
    name: 'Creator Marketplace',
    price: 'Commission only',
    period: '',
    description: 'Unlimited creations. Earn from every sale.',
    highlights: ['Unlimited creations', 'Keep 70% of every sale', 'Unlimited marketplace buyers', 'Personal creator storefront'],
    accent: '#2E2886',
    cta: 'Switch to Marketplace',
  },
  {
    id: 'institution',
    name: 'Institution',
    price: 'Custom',
    period: '/month',
    description: 'For schools, universities, and corporate teams.',
    highlights: ['Unlimited creations', '100 enrolled students base', 'Per-head pricing beyond 100', 'Certificates, custom templates'],
    accent: '#1A8966',
    cta: 'Contact us',
  },
]

const ADD_ONS = [
  { id: 'ai_course_builder', name: 'AI Course Builder', desc: 'Generate full courses from a topic prompt.', price: 'GHS 150/mo' },
  { id: 'ai_assessment_builder', name: 'AI Assessment Builder', desc: 'Generate exams and question sets from a syllabus.', price: 'GHS 100/mo' },
  { id: 'ai_hints', name: 'AI Hints', desc: 'Auto-generate contextual hints for exam questions.', price: 'GHS 50/mo' },
  { id: 'ai_explanations', name: 'AI Explanations', desc: 'Auto-generate answer explanations after submission.', price: 'GHS 50/mo' },
  { id: 'ai_training_builder', name: 'AI Training Builder', desc: 'Generate structured training paths from a brief.', price: 'Coming soon' },
]

export default function BillingPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState('membership')
  const [usage, setUsage] = useState<CreationUsage | null>(null)
  const [activeAddOns, setActiveAddOns] = useState<string[]>([])
  const [poolAssess, setPoolAssess] = useState(10)
  const [poolEngage, setPoolEngage] = useState(10)
  const [poolLearn, setPoolLearn] = useState(10)
  const [poolTrain, setPoolTrain] = useState(10)
  const [savingAlloc, setSavingAlloc] = useState(false)
  const [allocMsg, setAllocMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user?.id
      if (!uid) return
      setUserId(uid)

      const { data: userRow } = await supabase.from('users').select('subscription_tier').eq('id', uid).maybeSingle()
      const tier = (userRow as { subscription_tier?: string } | null)?.subscription_tier ?? 'membership'
      setCurrentTier(tier)

      const u = await getCreationUsage(uid)
      setUsage(u)
      if (u && tier === 'creator_quarterly') {
        setPoolAssess(u.assess_quota)
        setPoolEngage(u.engage_quota)
        setPoolLearn(u.learn_quota)
        setPoolTrain(u.train_quota)
      }

      const { data: addOnData } = await supabase.from('user_add_ons').select('add_on_id').eq('user_id', uid).eq('status', 'active')
      setActiveAddOns((addOnData ?? []).map((r: { add_on_id: string }) => r.add_on_id))
    }
    load()
  }, [])

  const poolTotal = poolAssess + poolEngage + poolLearn + poolTrain

  async function saveAllocation() {
    if (poolTotal > 40 || !userId) return
    setSavingAlloc(true)
    await supabase.from('creation_usage').upsert({
      user_id: userId,
      assess_quota: poolAssess,
      engage_quota: poolEngage,
      learn_quota: poolLearn,
      train_quota: poolTrain,
    })
    setSavingAlloc(false)
    setAllocMsg('Allocation saved.')
    setTimeout(() => setAllocMsg(''), 3000)
  }

  const currentPlan = PLANS.find(p => p.id === currentTier) ?? PLANS[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Plan and billing"
        left={
          <Link href="/platform/settings" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            ← Settings
          </Link>
        }
      />

      <div style={{ padding: '28px 32px 60px', maxWidth: 860 }}>

        {/* Current plan banner */}
        <div style={{
          background: 'var(--white)',
          borderRadius: 12,
          padding: '20px 24px',
          boxShadow: 'var(--shadow-soft)',
          borderLeft: `3px solid ${currentPlan.accent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: currentPlan.accent, marginBottom: 3 }}>Current plan</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--near-black)' }}>{currentPlan.name}</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 3 }}>{currentPlan.description}</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>
            {currentPlan.price}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--mid-grey)' }}>{currentPlan.period}</span>
          </p>
        </div>

        {/* Usage bars */}
        {usage && currentTier !== 'institution' && currentTier !== 'creator_marketplace' && (
          <div className="sphere-card" style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Creation usage this period</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {(['assess', 'engage', 'learn', 'train'] as Mod[]).map(mod => {
                const quota = usage[`${mod}_quota` as keyof CreationUsage] as number
                const used = usage[`${mod}_used` as keyof CreationUsage] as number
                if (quota === 0) return null
                const pct = Math.min((used / Math.max(quota, 1)) * 100, 100)
                return (
                  <div key={mod}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: MODULE_COLOR[mod] }}>{MODULE_LABEL[mod]}</span>
                      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{used} / {quota}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: MODULE_COLOR[mod], borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pool allocation */}
        {currentTier === 'creator_quarterly' && (
          <div className="sphere-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2 }}>Redistribute your creation pool</p>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>40 total — allocate across modules however you need.</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: poolTotal > 40 ? 'var(--coral)' : poolTotal === 40 ? 'var(--teal)' : 'var(--mid-grey)' }}>
                {poolTotal} / 40
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([['assess', poolAssess, setPoolAssess], ['engage', poolEngage, setPoolEngage], ['learn', poolLearn, setPoolLearn], ['train', poolTrain, setPoolTrain]] as [Mod, number, (v: number) => void][]).map(([mod, val, setter]) => (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: MODULE_COLOR[mod], width: 52, flexShrink: 0 }}>{MODULE_LABEL[mod]}</span>
                  <input type="range" min={0} max={40} value={val} onChange={e => setter(Number(e.target.value))} style={{ flex: 1, accentColor: MODULE_COLOR[mod] }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', width: 28, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <button onClick={saveAllocation} disabled={savingAlloc || poolTotal > 40} style={{
                height: 36, padding: '0 18px', borderRadius: 8, border: 'none',
                background: poolTotal > 40 ? 'var(--bg2)' : 'var(--amber)',
                color: poolTotal > 40 ? 'var(--mid-grey)' : '#fff',
                fontSize: 13, fontWeight: 600, cursor: poolTotal > 40 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>{savingAlloc ? 'Saving...' : 'Save allocation'}</button>
              {allocMsg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{allocMsg}</p>}
              {poolTotal > 40 && <p style={{ fontSize: 12, color: 'var(--coral)' }}>Total exceeds 40.</p>}
            </div>
          </div>
        )}

        {/* Plan cards */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Available plans</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 28 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentTier
            return (
              <div key={plan.id} style={{
                background: 'var(--white)', borderRadius: 12, padding: '18px 20px',
                boxShadow: isCurrent ? `0 0 0 2px ${plan.accent}` : 'var(--shadow-soft)',
                borderTop: `3px solid ${plan.accent}`, display: 'flex', flexDirection: 'column',
              }}>
                {isCurrent && <span style={{ fontSize: 10, fontWeight: 700, color: plan.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Your plan</span>}
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--near-black)', marginBottom: 2 }}>{plan.name}</p>
                <p style={{ fontSize: 19, fontWeight: 700, color: plan.accent, marginBottom: 10 }}>
                  {plan.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--mid-grey)' }}>{plan.period}</span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, flex: 1 }}>
                  {plan.highlights.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                        <circle cx="6" cy="6" r="5" fill={`${plan.accent}20`} />
                        <path d="M3.5 6L5.2 7.7L8.5 4.5" stroke={plan.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>{h}</span>
                    </div>
                  ))}
                </div>
                <button
                  disabled={isCurrent}
                  onClick={() => { if (plan.id === 'institution') window.location.href = 'mailto:hello@spheresds.com?subject=Institution plan enquiry' }}
                  style={{
                    height: 34, background: isCurrent ? 'var(--bg2)' : plan.accent,
                    color: isCurrent ? 'var(--mid-grey)' : '#fff', border: 'none', borderRadius: 7,
                    fontSize: 12, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >{isCurrent ? 'Current plan' : plan.cta}</button>
              </div>
            )
          })}
        </div>

        {/* AI Add-ons */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>AI add-ons</p>
        {currentTier === 'membership' && (
          <div style={{ background: 'var(--amber-light)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: '#9A5800' }}>AI add-ons are available on Creator and Institution plans.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ADD_ONS.map(addon => {
            const isActive = activeAddOns.includes(addon.id)
            const locked = currentTier === 'membership'
            const comingSoon = addon.price === 'Coming soon'
            return (
              <div key={addon.id} style={{
                background: 'var(--white)', borderRadius: 10, padding: '14px 18px',
                boxShadow: 'var(--shadow-soft)', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16, opacity: locked || comingSoon ? 0.6 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2 }}>{addon.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{addon.desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: comingSoon ? 'var(--text-tertiary)' : 'var(--near-black)' }}>{addon.price}</span>
                  {!comingSoon && !locked && (
                    <button style={{
                      height: 30, padding: '0 12px', borderRadius: 20, border: 'none',
                      background: isActive ? 'var(--teal-light)' : 'var(--amber)',
                      color: isActive ? 'var(--teal)' : '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{isActive ? 'Active' : 'Add to plan'}</button>
                  )}
                  {(locked || comingSoon) && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg2)', padding: '4px 10px', borderRadius: 20 }}>
                      {comingSoon ? 'Coming soon' : 'Upgrade required'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 28, textAlign: 'center' }}>
          Questions? Email <a href="mailto:hello@spheresds.com" style={{ color: 'var(--amber)', textDecoration: 'none' }}>hello@spheresds.com</a>
        </p>
      </div>
    </div>
  )
}
