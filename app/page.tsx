'use client'

import Link from 'next/link'

const MODES = [
  { key: 'engage', label: 'Engage', color: '#EF9F27', bg: '#FEF3DC', desc: 'Live quizzes and game-based learning that make any lesson impossible to ignore.' },
  { key: 'assess', label: 'Assess', color: '#E05C4B', bg: '#FDECEA', desc: 'Formal examinations with real-time invigilation, auto-grading, and instant results.' },
  { key: 'learn', label: 'Learn', color: '#2BA888', bg: '#E1F5EE', desc: 'A full LMS for structured courses: video, reading, quizzes, and assignments in one place.' },
  { key: 'train', label: 'Train', color: '#185FA5', bg: '#E6F1FB', desc: 'Compliance training, onboarding paths, skill tracking, and digital sign-off for teams.' },
]

const PERSONAS = [
  {
    label: 'Schools and colleges',
    scenario: 'You run a JHS in Kumasi. You need exam tools that work without reliable WiFi, quizzes that keep students awake, and a place to host all your course materials.',
    modules: ['Engage', 'Assess', 'Learn'],
    colors: ['#EF9F27', '#E05C4B', '#2BA888'],
    price: 'GHS 420',
    tag: 'Most popular for schools',
  },
  {
    label: 'Companies and teams',
    scenario: 'Your company is growing. You need new hires onboarded properly, compliance policies signed off, and a way to track who has completed what across your team.',
    modules: ['Train'],
    colors: ['#185FA5'],
    price: 'GHS 200',
    tag: 'Built for HR and L&D teams',
  },
  {
    label: 'Individual educators',
    scenario: 'You create content, tutor students, or run a small training business. You need a clean place to host your courses and track your learners, without enterprise pricing.',
    modules: ['Learn'],
    colors: ['#2BA888'],
    price: 'GHS 150',
    tag: 'Perfect for solo educators',
  },
]

const PRICING = [
  {
    name: 'Solo',
    price: 'GHS 150',
    period: '/month',
    desc: 'One module. One educator. Everything you need to get started.',
    modules: 1,
    users: '50 learners',
    highlight: false,
    cta: 'Start free trial',
  },
  {
    name: 'Institution',
    price: 'GHS 420',
    period: '/month',
    desc: 'Three modules. Built for schools and training centres with multiple teachers.',
    modules: 3,
    users: '500 learners',
    highlight: true,
    cta: 'Start free trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'All four modules, unlimited users, dedicated support, and custom integrations.',
    modules: 4,
    users: 'Unlimited',
    highlight: false,
    cta: 'Talk to us',
  },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#EFE9DD', minHeight: '100vh', fontFamily: 'var(--font)' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#EFE9DD',
        borderBottom: '0.5px solid #D0CBBC',
        padding: '0 40px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#EF9F27" strokeWidth="1.5" />
            <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#EF9F27" strokeWidth="1.2" />
            <line x1="1" y1="12" x2="23" y2="12" stroke="#EF9F27" strokeWidth="1.2" />
            <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#EF9F27" strokeWidth="1" />
            <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#EF9F27" strokeWidth="1" />
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            Sphere<span style={{ color: '#EF9F27' }}>SDS</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" style={{
            padding: '8px 18px', borderRadius: 8,
            border: '1px solid #D0CBBC', background: 'transparent',
            fontSize: 14, fontWeight: 500, color: '#1A1A1A', textDecoration: 'none',
          }}>
            Sign in
          </Link>
          <Link href="/onboarding" style={{
            padding: '8px 18px', borderRadius: 8,
            background: '#EF9F27', color: '#fff',
            fontSize: 14, fontWeight: 500, textDecoration: 'none',
          }}>
            Start free trial
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '80px 40px 72px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 20 }}>
              Africa&apos;s learning and assessment platform
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 54,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#1A1A1A',
              marginBottom: 24,
              maxWidth: 560,
            }}>
              One platform for every learning scenario.
            </h1>
            <p style={{ fontSize: 18, color: '#5A5A5A', lineHeight: 1.65, marginBottom: 36, maxWidth: 480 }}>
              SphereSDS gives schools, companies, and educators four purpose-built tools in one place. Use one. Use all four. Pay for exactly what you need.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link href="/onboarding" style={{
                display: 'inline-block',
                padding: '14px 28px', borderRadius: 10,
                background: '#EF9F27', color: '#fff',
                fontSize: 16, fontWeight: 500, textDecoration: 'none',
              }}>
                Start free, 14 days, no card
              </Link>
              <Link href="/join" style={{
                fontSize: 14, color: '#5A5A5A', textDecoration: 'none',
                borderBottom: '1px solid #D0CBBC',
              }}>
                Joining a session? Enter code
              </Link>
            </div>
            <p style={{ marginTop: 20, fontSize: 13, color: '#5A5A5A' }}>
              Payments via MTN MoMo · GHS pricing · Cancel any time
            </p>
          </div>

          {/* Mode visual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {MODES.map((m) => (
              <div key={m.key} style={{
                background: '#fff',
                border: '0.5px solid #E2DDD3',
                borderRadius: 14,
                padding: '18px 16px',
                borderTop: `3px solid ${m.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.label}</span>
                </div>
                <p style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.5 }}>{m.desc.split('.')[0]}.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IS IT FOR */}
      <section style={{ padding: '64px 40px', borderTop: '0.5px solid #D0CBBC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 10 }}>
            Who it&apos;s built for
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', color: '#1A1A1A', marginBottom: 48, maxWidth: 460 }}>
            Three types of institutions. One platform.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {PERSONAS.map((p, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '0.5px solid #E2DDD3',
                borderRadius: 14,
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <span style={{
                  display: 'inline-block', alignSelf: 'flex-start',
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: '#5A5A5A', background: '#EAE6DC',
                  padding: '3px 8px', borderRadius: 4, marginBottom: 14,
                }}>
                  {p.tag}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', marginBottom: 12, lineHeight: 1.3 }}>
                  {p.label}
                </h3>
                <p style={{ fontSize: 14, color: '#5A5A5A', lineHeight: 1.65, marginBottom: 24, flex: 1 }}>
                  {p.scenario}
                </p>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A5A5A', marginBottom: 8 }}>
                    Modules included
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.modules.map((mod, mi) => (
                      <span key={mod} style={{
                        fontSize: 12, fontWeight: 500,
                        color: p.colors[mi],
                        background: `${p.colors[mi]}14`,
                        border: `1px solid ${p.colors[mi]}30`,
                        padding: '3px 10px', borderRadius: 20,
                      }}>
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#1A1A1A' }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: '#5A5A5A' }}>/month</span>
                </div>
                <Link href="/onboarding" style={{
                  display: 'block', textAlign: 'center',
                  padding: '11px 0', borderRadius: 8,
                  border: '1px solid #D0CBBC', background: 'transparent',
                  fontSize: 14, fontWeight: 500, color: '#1A1A1A',
                  textDecoration: 'none',
                }}>
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODES IN DEPTH */}
      <section style={{ padding: '64px 40px', borderTop: '0.5px solid #D0CBBC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 10 }}>
            Four modes
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', color: '#1A1A1A', marginBottom: 48, maxWidth: 440 }}>
            Each one built for a specific job.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {MODES.map((m, i) => (
              <div key={m.key} style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr auto',
                alignItems: 'center',
                gap: 40,
                padding: '28px 0',
                borderTop: i === 0 ? '0.5px solid #D0CBBC' : 'none',
                borderBottom: '0.5px solid #D0CBBC',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A' }}>{m.label}</span>
                </div>
                <p style={{ fontSize: 15, color: '#5A5A5A', lineHeight: 1.65 }}>{m.desc}</p>
                <span style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: m.color, background: m.bg,
                  padding: '4px 10px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {m.key === 'engage' ? 'Schools · Teams' : m.key === 'assess' ? 'Schools · Institutions' : m.key === 'learn' ? 'All types' : 'Companies · HR'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '64px 40px', borderTop: '0.5px solid #D0CBBC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 60, alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 10 }}>
                Pricing
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', color: '#1A1A1A', marginBottom: 16, lineHeight: 1.2 }}>
                Pay for what you use. Nothing more.
              </h2>
              <p style={{ fontSize: 15, color: '#5A5A5A', lineHeight: 1.65, marginBottom: 24 }}>
                Every plan includes a 14-day free trial. No credit card required. Pay monthly via MTN MoMo, Telecel Cash, or bank transfer.
              </p>
              <p style={{ fontSize: 13, color: '#5A5A5A' }}>
                Need a custom combination of modules?{' '}
                <a href="mailto:hello@b-vm.com" style={{ color: '#EF9F27', textDecoration: 'none' }}>
                  Talk to us directly.
                </a>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {PRICING.map((plan) => (
                <div key={plan.name} style={{
                  background: plan.highlight ? '#1A1A1A' : '#fff',
                  border: `0.5px solid ${plan.highlight ? '#1A1A1A' : '#E2DDD3'}`,
                  borderRadius: 14,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#5A5A5A', marginBottom: 12 }}>
                    {plan.name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: plan.highlight ? '#fff' : '#1A1A1A' }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#5A5A5A' }}>
                      {plan.period}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.65)' : '#5A5A5A', lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
                    {plan.desc}
                  </p>
                  <div style={{ marginBottom: 20 }}>
                    {[
                      `${plan.modules} module${plan.modules > 1 ? 's' : ''}`,
                      plan.users,
                      '14-day free trial',
                      'MTN MoMo billing',
                    ].map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke={plan.highlight ? '#EF9F27' : '#2BA888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#5A5A5A' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={plan.name === 'Enterprise' ? 'mailto:hello@b-vm.com' : '/onboarding'} style={{
                    display: 'block', textAlign: 'center',
                    padding: '11px 0', borderRadius: 8,
                    background: plan.highlight ? '#EF9F27' : 'transparent',
                    border: plan.highlight ? 'none' : '1px solid #D0CBBC',
                    fontSize: 14, fontWeight: 500,
                    color: plan.highlight ? '#fff' : '#1A1A1A',
                    textDecoration: 'none',
                  }}>
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: '80px 40px', borderTop: '0.5px solid #D0CBBC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 40 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: '#1A1A1A', marginBottom: 12, lineHeight: 1.15 }}>
              Your institution is ready<br />when you are.
            </h2>
            <p style={{ fontSize: 16, color: '#5A5A5A' }}>
              Set up in under 10 minutes. No IT team required.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <Link href="/onboarding" style={{
              display: 'inline-block',
              padding: '16px 32px', borderRadius: 10,
              background: '#EF9F27', color: '#fff',
              fontSize: 16, fontWeight: 500, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              Start free, no card needed
            </Link>
            <p style={{ fontSize: 12, color: '#5A5A5A' }}>Already have an account?{' '}
              <Link href="/login" style={{ color: '#1A1A1A', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: '0.5px solid #D0CBBC',
        padding: '24px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#EF9F27" strokeWidth="1.5" />
            <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#EF9F27" strokeWidth="1.2" />
            <line x1="1" y1="12" x2="23" y2="12" stroke="#EF9F27" strokeWidth="1.2" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', fontFamily: 'var(--font-display)' }}>
            Sphere<span style={{ color: '#EF9F27' }}>SDS</span>
          </span>
          <span style={{ fontSize: 13, color: '#5A5A5A', marginLeft: 8 }}>by Bold Vision MultiTech · Accra, Ghana</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Contact'].map((l) => (
            <a key={l} href="#" style={{ fontSize: 13, color: '#5A5A5A', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
