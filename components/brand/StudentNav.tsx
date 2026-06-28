'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/student/learn', label: 'Learn' },
  { href: '/student/progress', label: 'Progress' },
  { href: '/student/profile', label: 'Profile' },
]

export default function StudentNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--white)',
        borderTop: '0.5px solid var(--border)',
        display: 'flex',
        zIndex: 50,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {NAV.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--near-black)' : 'var(--mid-grey)',
              textDecoration: 'none',
              borderTop: active ? '2px solid var(--near-black)' : '2px solid transparent',
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
