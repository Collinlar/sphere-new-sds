'use client'

import TopBar from '@/components/brand/TopBar'

export default function MarketplacePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Marketplace" />

      <div style={{ padding: '28px 32px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
          Content marketplace
        </h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 36 }}>
          Ready-made quizzes, exams, courses, and training paths from verified Ghanaian educators
        </p>

        <div style={{
          background: 'var(--white)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '56px 48px',
          textAlign: 'center',
          maxWidth: 560,
          margin: '0 auto',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#EEEDF8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M3 9h18M9 21V9M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke="#36318F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
            Marketplace is coming soon
          </p>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.65, marginBottom: 24 }}>
            We are building a library of Ghanaian curriculum-aligned content from verified educators. Quizzes, BECE prep packs, compliance training sets, and full courses you can import into your institution with one click.
          </p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
            Want to sell your content here?{' '}
            <a href="mailto:hello@spheresds.com" style={{ color: '#36318F', fontWeight: 500, textDecoration: 'none' }}>
              Get in touch
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
