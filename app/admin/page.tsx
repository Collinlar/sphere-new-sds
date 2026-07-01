'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminGetStats, adminGetMarketplaceRevenue } from '@/lib/admin'

interface Stats {
  totalInstitutions: number
  totalUsers: number
  totalMembers: number
  pendingApprovals: number
  pendingCreators: number
  pendingListings: number
  guestUnclaimed: number
  signupsThisWeek: number
  signupsLastWeek: number
}

interface Revenue {
  revenueThisMonth: number
  salesThisMonth: number
  totalRevenue: number
}

function StatCard({ label, value, sub, accent, href }: { label: string; value: string | number; sub?: string; accent?: string; href?: string }) {
  const inner = (
    <div style={{
      background: 'var(--white)',
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: 'var(--shadow-soft)',
      borderTop: `2px solid ${accent ?? 'var(--border)'}`,
      height: '100%',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
  return inner
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [revenue, setRevenue] = useState<Revenue | null>(null)

  useEffect(() => {
    adminGetStats().then(setStats)
    adminGetMarketplaceRevenue().then(setRevenue)
  }, [])

  const signupDelta = stats ? stats.signupsThisWeek - stats.signupsLastWeek : 0
  const signupDeltaLabel = signupDelta === 0
    ? 'same as last week'
    : signupDelta > 0
      ? `+${signupDelta} vs last week`
      : `${signupDelta} vs last week`

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>
          SphereSDS Internal
        </p>
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.03em' }}>Dashboard</p>
      </div>

      {/* Alerts — pending approvals */}
      {stats && stats.pendingApprovals > 0 && (
        <div style={{
          background: '#FFF8ED',
          border: '0.5px solid #D97010',
          borderLeft: '3px solid #D97010',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#7A4A00' }}>
              {stats.pendingApprovals} approval{stats.pendingApprovals !== 1 ? 's' : ''} waiting
            </p>
            <p style={{ fontSize: 12, color: '#9A6010', marginTop: 2 }}>
              {stats.pendingCreators > 0 && `${stats.pendingCreators} creator profile${stats.pendingCreators !== 1 ? 's' : ''}`}
              {stats.pendingCreators > 0 && stats.pendingListings > 0 && ' · '}
              {stats.pendingListings > 0 && `${stats.pendingListings} marketplace listing${stats.pendingListings !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link href="/admin/marketplace" style={{ fontSize: 13, fontWeight: 600, color: '#D97010', textDecoration: 'none', background: 'rgba(217,112,16,0.1)', padding: '7px 14px', borderRadius: 20 }}>
            Review now
          </Link>
        </div>
      )}

      {stats && stats.guestUnclaimed > 0 && (
        <div style={{
          background: 'var(--blue-light, #E6F1FB)',
          border: '0.5px solid #185FA5',
          borderLeft: '3px solid #185FA5',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0D3D6B' }}>
            {stats.guestUnclaimed} unclaimed guest session{stats.guestUnclaimed !== 1 ? 's' : ''} older than 7 days
          </p>
          <p style={{ fontSize: 12, color: '#185FA5', marginTop: 2 }}>These users completed exams or games without an account and have not claimed their results.</p>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard label="Institutions" value={stats?.totalInstitutions ?? '—'} accent="#1A8966" href="/admin/institutions" />
        <StatCard label="Total users" value={stats?.totalUsers ?? '—'} sub={`${stats?.totalMembers ?? 0} on free membership`} accent="#1052A3" href="/admin/users" />
        <StatCard label="Signups this week" value={stats?.signupsThisWeek ?? '—'} sub={signupDeltaLabel} accent="#D97010" />
        <StatCard label="Marketplace revenue" value={revenue ? `GH₵ ${revenue.revenueThisMonth.toFixed(0)}` : '—'} sub={revenue ? `${revenue.salesThisMonth} sales this month` : undefined} accent="#2E2886" href="/admin/marketplace" />
        <StatCard label="Pending approvals" value={stats?.pendingApprovals ?? '—'} accent={stats?.pendingApprovals ? '#C23B2A' : 'var(--border)'} href="/admin/marketplace" />
        <StatCard label="Unclaimed guests" value={stats?.guestUnclaimed ?? '—'} sub="older than 7 days" accent="var(--border)" />
      </div>

      {/* Quick nav */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 14 }}>
        Quick access
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {[
          { label: 'Review marketplace approvals', href: '/admin/marketplace', color: '#D97010' },
          { label: 'Manage users and tiers', href: '/admin/users', color: '#1052A3' },
          { label: 'View institution accounts', href: '/admin/institutions', color: '#1A8966' },
          { label: 'Browse all content', href: '/admin/content', color: '#2E2886' },
          { label: 'Certificate log', href: '/admin/certificates', color: '#C23B2A' },
          { label: 'Platform configuration', href: '/admin/config', color: 'var(--near-black)' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              background: 'var(--white)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: 'var(--shadow-soft)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{item.label}</span>
            <span style={{ color: item.color, fontSize: 16, flexShrink: 0 }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
