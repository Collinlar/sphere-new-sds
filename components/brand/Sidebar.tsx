'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const ALL_MODES = [
  { key: 'engage', label: 'Engage', color: '#EF9F27', href: '/engage' },
  { key: 'assess', label: 'Assess', color: '#E05C4B', href: '/assess' },
  { key: 'learn', label: 'Learn', color: '#2BA888', href: '/learn' },
  { key: 'train', label: 'Train', color: '#185FA5', href: '/train' },
]

const PLATFORM = [
  { key: 'library', label: 'Content library', href: '/platform/library' },
  { key: 'marketplace', label: 'Marketplace', href: '/platform/marketplace' },
  { key: 'analytics', label: 'Analytics', href: '/platform/analytics' },
  { key: 'settings', label: 'Settings', href: '/platform/settings' },
]

interface SidebarProps {
  activeMode?: string
  institutionName?: string
  userName?: string
}

export default function Sidebar({ activeMode, institutionName, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [displayName, setDisplayName] = useState(userName ?? '')
  const [displayInstitution, setDisplayInstitution] = useState(institutionName ?? '')
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({
    engage: true, assess: true, learn: true, train: true,
  })
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    setDisplayName(user.name)
    setIsAdmin(user.role === 'admin')

    const cachedInstitution = typeof window !== 'undefined'
      ? localStorage.getItem('sphere_institution') ?? ''
      : ''
    setDisplayInstitution(cachedInstitution || institutionName || '')

    // Fetch live module state for this institution
    if (user.institution_id) {
      supabase
        .from('institutions')
        .select('modules, name')
        .eq('id', user.institution_id)
        .single()
        .then(({ data }) => {
          if (data?.modules) setActiveModules(data.modules as Record<string, boolean>)
          if (data?.name) setDisplayInstitution(data.name)
        })
    }
  }, [institutionName])

  async function handleSignOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('sphere_user')
    localStorage.removeItem('sphere_institution')
    router.push('/login')
  }

  const currentAccent = getAccentForPath(pathname, activeMode)

  return (
    <aside style={{
      position: 'fixed',
      left: 0, top: 0,
      width: 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--white)',
      borderRight: '0.5px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px',
      zIndex: 200,
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 4px 14px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke={currentAccent} strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="5" ry="11" stroke={currentAccent} strokeWidth="1.2" />
          <line x1="1" y1="12" x2="23" y2="12" stroke={currentAccent} strokeWidth="1.2" />
          <line x1="3.5" y1="6" x2="20.5" y2="6" stroke={currentAccent} strokeWidth="1" />
          <line x1="3.5" y1="18" x2="20.5" y2="18" stroke={currentAccent} strokeWidth="1" />
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--near-black)' }}>
          Sphere<span style={{ color: currentAccent }}>SDS</span>
        </span>
      </div>

      {/* Modes */}
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--mid-grey)', textTransform: 'uppercase', padding: '4px 4px 4px', marginBottom: 2 }}>
        Modes
      </p>
      {ALL_MODES.map((m) => {
        const isActive = pathname.startsWith(m.href)
        const isEnabled = activeModules[m.key] !== false

        if (!isEnabled) {
          return (
            <Link
              key={m.key}
              href="/platform/settings"
              title="Upgrade to unlock"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px', borderRadius: 7, textDecoration: 'none',
                opacity: 0.4,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>{m.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '1px 5px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Upgrade
              </span>
            </Link>
          )
        }

        return (
          <Link
            key={m.key}
            href={m.href}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 7, textDecoration: 'none',
              background: isActive ? `${m.color}18` : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? m.color : 'var(--near-black)' }}>
              {m.label}
            </span>
          </Link>
        )
      })}

      {/* Students (rosters) */}
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--mid-grey)', textTransform: 'uppercase', padding: '14px 4px 4px', marginBottom: 2 }}>
        Classes
      </p>
      <Link
        href="/students"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', borderRadius: 7, textDecoration: 'none',
          background: pathname.startsWith('/students') ? '#36318F18' : 'transparent',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#36318F', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: pathname.startsWith('/students') ? 600 : 400, color: pathname.startsWith('/students') ? '#36318F' : 'var(--near-black)' }}>
          Students
        </span>
      </Link>

      {/* Platform (admin only) */}
      {isAdmin && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--mid-grey)', textTransform: 'uppercase', padding: '14px 4px 4px', marginBottom: 2 }}>
            Platform
          </p>
          {PLATFORM.map((p) => {
            const isActive = pathname.startsWith(p.href)
            return (
              <Link key={p.key} href={p.href} style={{
                display: 'flex', alignItems: 'center',
                padding: '7px 8px', borderRadius: 7, textDecoration: 'none',
                background: isActive ? 'var(--violet-light)' : 'transparent',
              }}>
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--violet)' : 'var(--mid-grey)' }}>
                  {p.label}
                </span>
              </Link>
            )
          })}
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: currentAccent, color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--near-black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName || 'Loading...'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--mid-grey)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayInstitution}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '7px 8px', borderRadius: 7,
            border: 'none', background: 'transparent',
            fontSize: 12, color: 'var(--mid-grey)',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

function getAccentForPath(pathname: string, activeMode?: string): string {
  if (activeMode) {
    const map: Record<string, string> = { engage: '#EF9F27', assess: '#E05C4B', learn: '#2BA888', train: '#185FA5', platform: '#36318F' }
    return map[activeMode] ?? '#EF9F27'
  }
  if (pathname.startsWith('/engage')) return '#EF9F27'
  if (pathname.startsWith('/assess')) return '#E05C4B'
  if (pathname.startsWith('/learn')) return '#2BA888'
  if (pathname.startsWith('/train')) return '#185FA5'
  if (pathname.startsWith('/platform')) return '#36318F'
  return '#EF9F27'
}
