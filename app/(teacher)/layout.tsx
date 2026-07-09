import { Suspense } from 'react'
import Sidebar from '@/components/brand/Sidebar'
import ModuleRouteGuard from '@/components/brand/ModuleRouteGuard'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main style={{ paddingLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
        <Suspense fallback={
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Checking your plan access...</p>
          </div>
        }>
          <ModuleRouteGuard>{children}</ModuleRouteGuard>
        </Suspense>
      </main>
    </>
  )
}
