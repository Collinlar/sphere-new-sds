import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'Pricing · SphereSDS',
  description: 'Simple plans for schools, creators, and institutions. Pay monthly via MTN MoMo, Telecel Cash, or bank transfer.',
}

// Re-read live prices from subscription_plans at most once a minute, so an
// admin price change in the panel reaches this public page without a deploy.
export const revalidate = 60

const PERIOD_LABEL: Record<string, string> = {
  monthly: '/month',
  quarterly: '/quarter',
  yearly: '/year',
}

// Overlay live price + billing period from the plan table onto each card,
// keeping the static string as the fallback (Free, Commission only) for
// plans whose price is 0/null.
async function fetchLivePrices(): Promise<Record<string, { price?: string; period?: string }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return {}
  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await db.from('subscription_plans').select('id, price_ghs, billing_period')
    const map: Record<string, { price?: string; period?: string }> = {}
    for (const row of data ?? []) {
      const priceGhs = row.price_ghs != null ? Number(row.price_ghs) : 0
      if (priceGhs > 0) {
        map[row.id as string] = {
          price: `GHS ${priceGhs.toLocaleString('en-GB')}`,
          period: PERIOD_LABEL[row.billing_period as string] ?? '',
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

const PLANS = [
  {
    id: 'membership', name: 'Membership', price: 'Free', period: '',
    tagline: 'Test the platform. Good for individuals exploring Sphere.',
    accent: '#6B6870', highlight: false, cta: 'Get started free', href: '/signup',
    features: ['5 Assess creations', '5 Engage creations', 'Up to 5 students per session', 'No credit card needed'],
  },
  {
    id: 'creator_quarterly', name: 'Creator Quarterly', price: 'GHS 300', period: '/quarter',
    tagline: 'For educators and trainers who create and sell resources.',
    accent: '#D97010', highlight: true, cta: 'Upgrade to Creator', href: '/signup',
    features: ['40 creations, allocate across modules', 'Up to 50 students per session', 'Sell on the marketplace (15% commission)', 'Issue certificates'],
  },
  {
    id: 'creator_marketplace', name: 'Creator Marketplace', price: 'Commission only', period: '',
    tagline: 'Earn from what you build, no quarterly fee.',
    accent: '#2E2886', highlight: false, cta: 'Start selling', href: '/signup',
    features: ['Unlimited creations', 'Keep 70% of every sale', 'Unlimited marketplace buyers', 'Personal creator storefront'],
  },
  {
    id: 'institution', name: 'Institution', price: 'GHS 1,000', period: '/quarter',
    tagline: 'For schools, colleges, and companies running at scale.',
    accent: '#1052A3', highlight: false, cta: 'Talk to Sphere', href: '/onboarding',
    features: ['Unlimited creations', 'All four modules', 'Up to 100 enrolled students included', 'Custom certificate templates'],
  },
]

export default async function PricingPage() {
  const livePrices = await fetchLivePrices()
  const plans = PLANS.map(plan => {
    const live = livePrices[plan.id]
    return live ? { ...plan, price: live.price ?? plan.price, period: live.period ?? plan.period } : plan
  })

  return (
    <div className="mkt-root" style={{ background: '#F5F4F1', minHeight: '100vh' }}>
      <MarketingNav />

      {/* Header */}
      <section className="sec" style={{ padding: '72px 48px 40px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 12 }}>Pricing</p>
        <h1 className="page-h1" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.035em', color: '#18171A', marginBottom: 16, lineHeight: 1.08 }}>Pay for what you use. Nothing more.</h1>
        <p style={{ fontSize: 16, color: '#6B6870', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
          Start free. Upgrade when you grow. Pay monthly via MTN MoMo, Telecel Cash, or bank transfer, in GHS.
        </p>
      </section>

      {/* Plans */}
      <section className="sec" style={{ padding: '8px 48px 72px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="pricing-plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, alignItems: 'stretch' }}>
          {plans.map(plan => (
            <div key={plan.id} className="pricing-card" style={{
              background: plan.highlight ? '#18171A' : '#fff',
              border: plan.highlight ? '0.5px solid #2A2730' : '0.5px solid #EDECE9',
              borderTop: `3px solid ${plan.accent}`,
              borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column',
              boxShadow: plan.highlight ? '0 12px 48px rgba(0,0,0,0.18)' : '0 2px 18px rgba(0,0,0,0.04)',
            }}>
              {plan.highlight && (
                <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97010', background: '#FEF0DC', padding: '3px 9px', borderRadius: 4, marginBottom: 14 }}>Most popular</span>
              )}
              <h3 style={{ fontSize: 17, fontWeight: 700, color: plan.highlight ? '#fff' : '#18171A', marginBottom: 6, letterSpacing: '-0.015em' }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: plan.highlight ? '#fff' : '#18171A', letterSpacing: '-0.02em' }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 13, color: plan.highlight ? '#A09DA8' : '#6B6870' }}>{plan.period}</span>}
              </div>
              <p style={{ fontSize: 13, color: plan.highlight ? '#A09DA8' : '#6B6870', lineHeight: 1.6, marginBottom: 20, flex: '0 0 auto', minHeight: 42 }}>{plan.tagline}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginTop: 3, flexShrink: 0 }}><path d="M2 6.5l3 3 6-6" stroke={plan.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 13, color: plan.highlight ? '#E5E3E8' : '#18171A', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href={plan.href} className={plan.highlight ? 'cta-primary' : 'cta-ghost'} style={{
                display: 'block', textAlign: 'center', padding: 13, borderRadius: 10,
                background: plan.highlight ? '#D97010' : 'transparent',
                border: plan.highlight ? 'none' : '1px solid #D0CBBC',
                color: plan.highlight ? '#fff' : '#18171A',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}>{plan.cta}</Link>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: '#A09DA8', textAlign: 'center', marginTop: 28, lineHeight: 1.6 }}>
          Institutions above 100 enrolled students are billed a small per-head rate. The AI builders are open on every plan and run on credits: each plan includes monthly credits, and you can top up from GHS 20 whenever you need more.
        </p>
      </section>

      {/* FAQ strip */}
      <section className="sec" style={{ padding: '64px 48px', borderTop: '0.5px solid #DDD9D2', background: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#18171A', marginBottom: 32 }}>Common questions</h2>
          {[
            { q: 'How do I pay?', a: 'MTN MoMo, Telecel Cash, or bank transfer through Paystack. No international card needed. Everything is priced in GHS.' },
            { q: 'Can I start free?', a: 'Yes. Membership is free forever and gives you real creation tools to test Engage and Assess with up to 5 students per session.' },
            { q: 'What is the marketplace?', a: 'Creators publish exams, quizzes, courses, guides, and notes for other educators to buy or import. Sphere handles delivery and the payment split.' },
            { q: 'Do you offer certificates?', a: 'Creator and Institution plans issue verifiable certificates. Institutions can upload their own branded template.' },
          ].map(item => (
            <div key={item.q} style={{ padding: '18px 0', borderBottom: '0.5px solid #EDECE9' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#18171A', marginBottom: 6 }}>{item.q}</p>
              <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.7 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="sec" style={{ padding: '72px 48px', borderTop: '0.5px solid #DDD9D2', background: '#18171A', textAlign: 'center' }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 12, lineHeight: 1.1 }}>Start free today.</h2>
        <p style={{ fontSize: 15, color: '#A09DA8', marginBottom: 26 }}>Set up your institution in under 10 minutes.</p>
        <Link href="/signup" className="cta-primary" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>Get started free</Link>
      </section>

      <MarketingFooter />
    </div>
  )
}
