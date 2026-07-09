'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const MODES = [
  { key: 'engage', label: 'Engage', color: '#D97010', desc: 'Live quizzes and game-based learning.' },
  { key: 'assess', label: 'Assess', color: '#C23B2A', desc: 'Formal exams with auto-grading.' },
  { key: 'learn', label: 'Learn', color: '#1A8966', desc: 'Full LMS: video, reading, assignments.' },
  { key: 'train', label: 'Train', color: '#1052A3', desc: 'Compliance and onboarding for teams.' },
]

export default function LandingPage() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) setJoinCode(code.toUpperCase().slice(0, 9))
    } catch { /* noop */ }
  }, [])

  function onJoinChange(e: React.ChangeEvent<HTMLInputElement>) {
    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))
  }

  function doJoin() {
    const code = joinCode.trim()
    if (!code) return
    router.push('/join?code=' + encodeURIComponent(code))
  }

  return (
    <div className="mkt-root" style={{ background: '#F5F4F1', minHeight: '100vh' }}>
      <MarketingNav />

      {/* HERO */}
      <section className="hero-sec sec" style={{ padding: '72px 48px 84px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 64, alignItems: 'center' }}>
          <div>
            <p className="mkt-anim-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#D97010', background: '#FEF0DC', padding: '5px 14px', borderRadius: 20, marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97010', display: 'inline-block', flexShrink: 0 }} />
              Africa&apos;s learning and assessment platform
            </p>
            <h1 className="mkt-anim-2 hero-h1" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.07, color: '#18171A', marginBottom: 22, maxWidth: 530 }}>
              One platform for every learning scenario.
            </h1>
            <p className="mkt-anim-3" style={{ fontSize: 17, color: '#6B6870', lineHeight: 1.72, marginBottom: 36, maxWidth: 460 }}>
              SphereSDS gives schools, companies, and educators four purpose-built tools in one place. Use one. Use all four. Pay for exactly what you need.
            </p>
            <div className="mkt-anim-4 cta-row" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <Link href="/onboarding" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '14px 28px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                Get started free
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/login" className="cta-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 24px', borderRadius: 10, border: '1px solid #D0CBBC', color: '#18171A', fontSize: 15, fontWeight: 500, textDecoration: 'none', background: 'transparent' }}>
                Sign in
              </Link>
            </div>
            <div className="mkt-anim-4" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {['No credit card', 'MTN MoMo billing', 'Cancel any time'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3 3 6-6" stroke="#1A8966" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={{ fontSize: 13, color: '#6B6870' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Join card */}
          <div className="hero-right" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 4px 48px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97010', flexShrink: 0 }} />
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#D97010' }}>Join a session</p>
              </div>
              <p style={{ fontSize: 14, color: '#A09DA8', lineHeight: 1.55, marginBottom: 18 }}>Got a code from your teacher? Enter it to join instantly.</p>
              <input
                type="text"
                placeholder="e.g. XK7P2Q"
                value={joinCode}
                onChange={onJoinChange}
                onKeyDown={e => { if (e.key === 'Enter') doJoin() }}
                maxLength={9}
                style={{ width: '100%', height: 58, padding: '0 16px', borderRadius: 10, border: '1.5px solid #E2E0DC', background: '#F9F8F6', fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', textAlign: 'center', color: '#18171A', outline: 'none', textTransform: 'uppercase', fontFamily: "'Outfit',sans-serif" }}
                onFocus={e => { e.currentTarget.style.borderColor = '#D97010'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,112,16,0.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E2E0DC'; e.currentTarget.style.background = '#F9F8F6'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button onClick={doJoin} className="join-btn-inner" style={{ width: '100%', height: 50, marginTop: 11, borderRadius: 9, background: '#D97010', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.01em' }}>
                Join now →
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 0.5, background: '#EDECE9' }} />
                <span style={{ fontSize: 12, color: '#C4C0BB', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 0.5, background: '#EDECE9' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/login" className="signin-link" style={{ display: 'block', textAlign: 'center', padding: 12, borderRadius: 8, border: '1px solid #E2E0DC', fontSize: 14, fontWeight: 500, color: '#18171A', textDecoration: 'none', background: 'transparent' }}>Sign in to your account</Link>
                <Link href="/onboarding" style={{ display: 'block', textAlign: 'center', padding: 10, fontSize: 14, color: '#6B6870', textDecoration: 'none' }}>New institution? <span style={{ color: '#D97010', fontWeight: 600 }}>Set up free →</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODES */}
      <section id="modes" className="sec" style={{ padding: '80px 48px', borderTop: '0.5px solid #DDD9D2', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Four modes</p>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 48, maxWidth: 420, lineHeight: 1.12 }}>Each one built for a specific job.</h2>
          <div className="why-grid modes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {MODES.map(m => (
              <Link key={m.key} href={`/product/${m.key}`} className="persona-card" style={{ display: 'block', background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 16, padding: 26, textDecoration: 'none', borderTop: `3px solid ${m.color}`, boxShadow: '0 2px 14px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#18171A', marginBottom: 8, letterSpacing: '-0.015em' }}>{m.label}</h3>
                <p style={{ fontSize: 13, color: '#6B6870', lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</p>
                <span style={{ fontSize: 13, fontWeight: 600, color: m.color }}>Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="for" className="sec" style={{ padding: '80px 48px', borderTop: '0.5px solid #DDD9D2', background: '#F5F4F1' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Who it&apos;s built for</p>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 56, lineHeight: 1.12, maxWidth: 480 }}>Three types of institutions. One platform.</h2>
          <div className="persona-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {/* Schools */}
            <div className="persona-card" style={{ background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 18, padding: 32, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 18px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
                {[['#FEF0DC', '#D97010'], ['#FDECEA', '#C23B2A'], ['#DDFAF0', '#1A8966']].map(([bg, dot]) => (
                  <span key={dot} style={{ width: 26, height: 26, borderRadius: 7, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} /></span>
                ))}
              </div>
              <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B6870', background: '#EDECE9', padding: '3px 9px', borderRadius: 4, marginBottom: 14 }}>Most popular</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#18171A', marginBottom: 12, letterSpacing: '-0.02em' }}>Schools and colleges</h3>
              <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.72, marginBottom: 28, flex: 1 }}>You run a JHS in Kumasi. You need exam tools that work without reliable WiFi, quizzes that keep students awake, and a place to host all your course materials.</p>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Modules included</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#D97010', background: '#FEF0DC', border: '1px solid rgba(217,112,16,0.18)', padding: '4px 12px', borderRadius: 20 }}>Engage</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#C23B2A', background: '#FDECEA', border: '1px solid rgba(194,59,42,0.16)', padding: '4px 12px', borderRadius: 20 }}>Assess</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A8966', background: '#DDFAF0', border: '1px solid rgba(26,137,102,0.16)', padding: '4px 12px', borderRadius: 20 }}>Learn</span>
                </div>
              </div>
              <Link href="/onboarding" className="cta-ghost" style={{ display: 'block', textAlign: 'center', padding: 13, borderRadius: 10, border: '1px solid #D0CBBC', fontSize: 14, fontWeight: 600, color: '#18171A', textDecoration: 'none', background: 'transparent' }}>Get started free</Link>
            </div>

            {/* Companies */}
            <div className="persona-card" style={{ background: '#18171A', border: '0.5px solid #2A2730', borderRadius: 18, padding: 32, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(16,82,163,0.20)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1052A3' }} /></span>
              </div>
              <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09DA8', background: '#2A2730', padding: '3px 9px', borderRadius: 4, marginBottom: 14 }}>Built for HR and L&amp;D</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>Companies and teams</h3>
              <p style={{ fontSize: 14, color: '#A09DA8', lineHeight: 1.72, marginBottom: 28, flex: 1 }}>Your company is growing. You need new hires onboarded properly, compliance policies signed off, and a way to track who has completed what across your team.</p>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6870', marginBottom: 10 }}>Modules included</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1052A3', background: 'rgba(16,82,163,0.18)', border: '1px solid rgba(16,82,163,0.26)', padding: '4px 12px', borderRadius: 20 }}>Train</span>
                </div>
              </div>
              <Link href="/onboarding" className="cta-primary" style={{ display: 'block', textAlign: 'center', padding: 13, borderRadius: 10, background: '#D97010', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>Get started free</Link>
            </div>

            {/* Individual educators */}
            <div className="persona-card" style={{ background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 18, padding: 32, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 18px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#DDFAF0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A8966' }} /></span>
              </div>
              <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B6870', background: '#EDECE9', padding: '3px 9px', borderRadius: 4, marginBottom: 14 }}>Solo educators</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#18171A', marginBottom: 12, letterSpacing: '-0.02em' }}>Individual educators</h3>
              <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.72, marginBottom: 28, flex: 1 }}>You create content, tutor students, or run a small training business. You need a clean place to host your courses and track your learners, without enterprise pricing.</p>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Modules included</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A8966', background: '#DDFAF0', border: '1px solid rgba(26,137,102,0.16)', padding: '4px 12px', borderRadius: 20 }}>Learn</span>
                </div>
              </div>
              <Link href="/onboarding" className="cta-ghost" style={{ display: 'block', textAlign: 'center', padding: 13, borderRadius: 10, border: '1px solid #D0CBBC', fontSize: 14, fontWeight: 600, color: '#18171A', textDecoration: 'none', background: 'transparent' }}>Get started free</Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="sec" style={{ padding: '80px 48px', borderTop: '0.5px solid #DDD9D2', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Why SphereSDS</p>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 56, lineHeight: 1.12, maxWidth: 460 }}>Built for Africa. Ready for anywhere.</h2>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40 }}>
            {[
              { bg: '#FEF0DC', title: 'Works offline', body: "Designed for Ghana's connectivity reality. Core features keep running even when the internet drops mid-session.", icon: <><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" stroke="#D97010" strokeWidth="1.5" /><path d="M12 2c-2.5 2.5-4 5.7-4 10s1.5 7.5 4 10" stroke="#D97010" strokeWidth="1.2" /><path d="M12 2c2.5 2.5 4 5.7 4 10s-1.5 7.5-4 10" stroke="#D97010" strokeWidth="1.2" /><line x1="2" y1="12" x2="22" y2="12" stroke="#D97010" strokeWidth="1.2" /></> },
              { bg: '#DDFAF0', title: 'Pay via MoMo', body: 'Pay monthly with MTN MoMo, Telecel Cash, or bank transfer. No international credit card required. GHS pricing throughout.', icon: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1A8966" strokeWidth="1.5" /><path d="M2 10h20" stroke="#1A8966" strokeWidth="1.4" /><path d="M6 15h4" stroke="#1A8966" strokeWidth="1.4" strokeLinecap="round" /></> },
              { bg: '#E3EDFB', title: 'One dashboard, four tools', body: 'No juggling five different apps. Engage, assess, learn, and train, all managed from a single, unified dashboard.', icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#1052A3" strokeWidth="1.5" strokeLinejoin="round" /><path d="M2 17l10 5 10-5" stroke="#1052A3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 12l10 5 10-5" stroke="#1052A3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></> },
            ].map(f => (
              <div key={f.title}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{f.icon}</svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#18171A', marginBottom: 9, letterSpacing: '-0.015em' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.72 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="pricing" className="sec" style={{ padding: '80px 48px', borderTop: '0.5px solid #DDD9D2', background: '#F5F4F1', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>Pricing</p>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 16, lineHeight: 1.15 }}>Pay for what you use. Nothing more.</h2>
          <p style={{ fontSize: 15, color: '#6B6870', lineHeight: 1.72, marginBottom: 28 }}>No credit card required. Pay monthly via MTN MoMo, Telecel Cash, or bank transfer.</p>
          <Link href="/pricing" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '14px 28px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            See plans and pricing
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="sec" style={{ padding: '84px 48px', borderTop: '0.5px solid #DDD9D2', background: '#18171A' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="bottom-cta" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.035em', color: '#fff', marginBottom: 12, lineHeight: 1.08 }}>Your institution is ready<br />when you are.</h2>
              <p style={{ fontSize: 16, color: '#A09DA8', lineHeight: 1.6 }}>Set up in under 10 minutes. No IT team required.</p>
            </div>
            <div className="bottom-cta-btns" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
              <Link href="/onboarding" className="cta-primary" style={{ display: 'inline-block', padding: '16px 32px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 16, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Start free, no card needed</Link>
              <p style={{ fontSize: 13, color: '#6B6870' }}>Already have an account? <Link href="/login" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Sign in →</Link></p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
