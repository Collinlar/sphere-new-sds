import { Suspense } from 'react'
import AppShell from '@/components/brand/AppShell'
import ModuleRouteGuard from '@/components/brand/ModuleRouteGuard'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Checking your plan access...</p>
        </div>
      }>
        <ModuleRouteGuard>{children}</ModuleRouteGuard>
      </Suspense>
    </AppShell>
  )
}
