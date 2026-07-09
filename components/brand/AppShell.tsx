'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/brand/Sidebar'

// Responsive shell for the teacher/creator/admin app. On desktop it renders
// the fixed sidebar exactly as before. On mobile the sidebar becomes an
// off-canvas drawer opened from a slim top bar; content runs full width.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the drawer whenever the route changes (e.g. a nav link was tapped).
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [drawerOpen])

  return (
    <>
      {/* Mobile top bar (hidden on desktop via CSS) */}
      <div className="app-mobile-bar">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
        >
          <span style={{ display: 'block', width: 20, height: 1.6, background: 'var(--near-black)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 20, height: 1.6, background: 'var(--near-black)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 14, height: 1.6, background: 'var(--near-black)', borderRadius: 2 }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#D97010" strokeWidth="1.5" />
            <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#D97010" strokeWidth="1.2" />
            <line x1="1" y1="12" x2="23" y2="12" stroke="#D97010" strokeWidth="1.2" />
            <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#D97010" strokeWidth="1" />
            <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#D97010" strokeWidth="1" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--near-black)' }}>Sphere<span style={{ color: '#D97010' }}>SDS</span></span>
        </div>
      </div>

      {/* Scrim behind the open drawer (mobile only via CSS) */}
      <div
        className={`app-scrim${drawerOpen ? ' app-scrim--open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <Sidebar drawerOpen={drawerOpen} />

      <main className="app-main" style={{ paddingLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
        {children}
      </main>
    </>
  )
}
