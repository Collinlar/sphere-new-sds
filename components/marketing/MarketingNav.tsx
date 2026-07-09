'use client'

import { useState } from 'react'
import Link from 'next/link'
import './marketing.css'

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke="#D97010" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#D97010" strokeWidth="1.2" />
      <line x1="1" y1="12" x2="23" y2="12" stroke="#D97010" strokeWidth="1.2" />
      <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#D97010" strokeWidth="1" />
      <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#D97010" strokeWidth="1" />
    </svg>
  )
}

// Platform link points at the landing modes anchor. On non-landing pages we
// send it to the landing page's #modes section.
export default function MarketingNav({ platformHref = '/#modes', forHref = '/#for' }: { platformHref?: string; forHref?: string }) {
  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <>
      <nav style={{ position: 'sticky', top: 0, zIndex: 200, background: 'rgba(245,244,241,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '0.5px solid #DDD9D2' }}>
        <div className="nav-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 64, display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <Logo />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em', color: '#18171A' }}>Sphere<span style={{ color: '#D97010' }}>SDS</span></span>
          </Link>

          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 26, flex: 1, justifyContent: 'center' }}>
            <Link href={platformHref} className="nav-link" style={{ fontSize: 14, color: '#6B6870', textDecoration: 'none', fontWeight: 500 }}>Platform</Link>
            <Link href={forHref} className="nav-link" style={{ fontSize: 14, color: '#6B6870', textDecoration: 'none', fontWeight: 500 }}>Who it&apos;s for</Link>
            <Link href="/pricing" className="nav-link" style={{ fontSize: 14, color: '#6B6870', textDecoration: 'none', fontWeight: 500 }}>Pricing</Link>
          </div>

          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Link href="/join" className="nav-link-amber" style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #D97010', color: '#D97010', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>Join session</Link>
            <Link href="/login" className="cta-ghost" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #DDD9D2', color: '#18171A', fontSize: 13, fontWeight: 500, textDecoration: 'none', background: 'transparent' }}>Sign in</Link>
            <Link href="/onboarding" className="cta-primary" style={{ padding: '8px 18px', borderRadius: 8, background: '#D97010', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Get started</Link>
          </div>

          <button aria-label="Menu" className="mob-trigger" onClick={() => setMobileMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
            <span style={{ display: 'block', width: 20, height: 1.5, background: '#18171A', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 20, height: 1.5, background: '#18171A', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 14, height: 1.5, background: '#18171A', borderRadius: 2 }} />
          </button>
        </div>
      </nav>

      {mobileMenu && (
        <div className="mob-overlay" style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, zIndex: 190, background: 'rgba(245,244,241,0.98)', backdropFilter: 'blur(20px)', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <Link href={platformHref} onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '16px 0', fontSize: 18, fontWeight: 500, color: '#18171A', textDecoration: 'none', borderBottom: '0.5px solid #DDD9D2' }}>Platform</Link>
          <Link href={forHref} onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '16px 0', fontSize: 18, fontWeight: 500, color: '#18171A', textDecoration: 'none', borderBottom: '0.5px solid #DDD9D2' }}>Who it&apos;s for</Link>
          <Link href="/pricing" onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '16px 0', fontSize: 18, fontWeight: 500, color: '#18171A', textDecoration: 'none', borderBottom: '0.5px solid #DDD9D2' }}>Pricing</Link>
          <div style={{ height: 20 }} />
          <Link href="/join" onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '15px 18px', borderRadius: 10, background: '#FEF0DC', color: '#D97010', fontSize: 16, fontWeight: 700, textDecoration: 'none', textAlign: 'center', marginBottom: 8 }}>Join a session →</Link>
          <Link href="/login" onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '13px 18px', borderRadius: 10, border: '1px solid #DDD9D2', color: '#18171A', fontSize: 15, fontWeight: 500, textDecoration: 'none', textAlign: 'center', marginBottom: 8 }}>Sign in</Link>
          <Link href="/onboarding" onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '13px 18px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>Get started free</Link>
        </div>
      )}
    </>
  )
}

export { Logo }
