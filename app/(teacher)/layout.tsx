import Sidebar from '@/components/brand/Sidebar'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main style={{ paddingLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
        {children}
      </main>
    </>
  )
}
