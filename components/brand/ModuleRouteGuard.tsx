'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { canAccessModule, type Module } from '@/lib/subscription'
import { resolveAcquiredRouteAccess } from '@/lib/acquisition-access'

const MODULE_ROUTE_PREFIXES: { prefix: string; module: Module }[] = [
  { prefix: '/assess', module: 'assess' },
  { prefix: '/learn', module: 'learn' },
  { prefix: '/train', module: 'train' },
  { prefix: '/engage', module: 'engage' },
]

function ModuleRouteGuardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const match = MODULE_ROUTE_PREFIXES.find(({ prefix }) => pathname.startsWith(prefix))
    if (!match) {
      setReady(true)
      return
    }

    let cancelled = false

    async function checkAccess() {
      const allowed = await canAccessModule(match!.module)
      if (cancelled) return
      if (allowed) {
        setReady(true)
        return
      }

      const acquiredOk = await resolveAcquiredRouteAccess(pathname, searchParams)
      if (cancelled) return
      if (acquiredOk) {
        setReady(true)
        return
      }

      router.replace(`/platform/settings/billing?locked=${match!.module}`)
    }

    setReady(false)
    checkAccess()

    return () => {
      cancelled = true
    }
  }, [pathname, router, searchParams])

  if (!ready) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Checking your plan access...</p>
      </div>
    )
  }

  return <>{children}</>
}

export default function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  return <ModuleRouteGuardInner>{children}</ModuleRouteGuardInner>
}
