import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer style={{ borderTop: '0.5px solid #2A2730', background: '#18171A' }} className="footer-pad">
      <div className="footer-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="#D97010" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#D97010" strokeWidth="1.2" />
              <line x1="1" y1="12" x2="23" y2="12" stroke="#D97010" strokeWidth="1.2" />
              <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#D97010" strokeWidth="1" />
              <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#D97010" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Sphere<span style={{ color: '#D97010' }}>SDS</span></span>
          </div>
          <span style={{ fontSize: 13, color: '#6B6870' }}>by Bold Vision MultiTech · Accra, Ghana</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ fontSize: 13, color: '#6B6870', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 13, color: '#6B6870', textDecoration: 'none' }}>Sign in</Link>
          <a href="mailto:hello@b-vm.com" style={{ fontSize: 13, color: '#6B6870', textDecoration: 'none' }}>Contact</a>
        </div>
      </div>
    </footer>
  )
}
