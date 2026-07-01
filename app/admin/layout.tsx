'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/institutions', label: 'Institutions', icon: '⬡' },
  { href: '/admin/users', label: 'Users', icon: '◉' },
  { href: '/admin/marketplace', label: 'Marketplace', icon: '◇' },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: '◎' },
  { href: '/admin/content', label: 'Content', icon: '▤' },
  { href: '/admin/certificates', label: 'Certificates', icon: '◫' },
  { href: '/admin/config', label: 'Config', icon: '⚙' },
]

// Hardcoded staff emails — bypass for initial setup before DB migration runs
const STAFF_EMAILS = [
  'kofcollkcl100@gmail.com',
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [staffName, setStaffName] = useState('')
  const [checking, setChecking] = useState(true)
  const [denied, setDenied] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    async function checkStaff() {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user?.id
      const email = sessionData.session?.user?.email ?? ''

      if (!uid) { router.replace('/login?from=/admin'); return }

      // Hardcoded email bypass — always works regardless of DB migration state
      if (STAFF_EMAILS.includes(email.toLowerCase())) {
        // Try to get name from users table — non-fatal if it fails
        const { data: userRow } = await supabase
          .from('users')
          .select('name')
          .eq('id', uid)
          .maybeSingle()
        setStaffName(userRow?.name ?? email)
        setChecking(false)
        return
      }

      // DB-driven check for staff added via Config panel
      const { data: userRow, error } = await supabase
        .from('users')
        .select('name, is_sphere_staff')
        .eq('id', uid)
        .maybeSingle()

      if (error || !userRow?.is_sphere_staff) {
        setDenied(true)
        setChecking(false)
        return
      }

      setStaffName(userRow.name ?? 'Staff')
      setChecking(false)
    }
    checkStaff()
  }, [router])

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1021', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Verifying access...</p>
      </div>
    )
  }

  if (denied) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1021', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600 }}>Access denied</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Your account does not have staff access.</p>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)', background: 'none', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Sign out
        </button>
      </div>
    )
  }

  const isExact = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)', fontFamily: 'var(--font)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#0C1021',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Sphere</p>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D97010', marginTop: 2 }}>
            Internal Admin
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(item => {
            const active = isExact(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  background: active ? 'rgba(217,112,16,0.15)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 14, color: active ? '#D97010' : 'rgba(255,255,255,0.3)', width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Staff identity */}
        <div style={{ padding: '14px 20px 18px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Signed in as</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{staffName}</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
