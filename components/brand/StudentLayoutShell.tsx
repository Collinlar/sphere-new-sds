'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import StudentNav from '@/components/brand/StudentNav'

const FOCUS_ROUTES = ['/student/assess', '/student/engage']

function isFocusRoute(pathname: string) {
  return FOCUS_ROUTES.some((route) => pathname.startsWith(route))
}

export default function StudentLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const focusMode = isFocusRoute(pathname)
  const showNav = isMobile && !focusMode

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div style={{ paddingBottom: showNav ? 72 : 0 }}>{children}</div>
      {showNav && <StudentNav />}
    </div>
  )
}
