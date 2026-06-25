export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      {children}
    </div>
  )
}
