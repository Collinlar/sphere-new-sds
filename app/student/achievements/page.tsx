'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { fetchStudentBadges } from '@/lib/student-badges'

export default function StudentAchievementsPage() {
  const [badges, setBadges] = useState<Awaited<ReturnType<typeof fetchStudentBadges>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = getCurrentUser()
      const badgeList = await fetchStudentBadges(user.id)
      setBadges(badgeList)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your achievements...</div>
  }

  const earned = badges.filter(b => b.earned)
  const locked = badges.filter(b => !b.earned)

  function BadgeCard({ badge }: { badge: Awaited<ReturnType<typeof fetchStudentBadges>>[number] }) {
    return (
      <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '16px 10px', flex: 1, textAlign: 'center', opacity: badge.earned ? 1 : 0.45 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: badge.earned ? badge.bg : 'var(--bg2)',
          margin: '0 auto 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
          color: badge.earned ? badge.color : 'var(--text-tertiary)',
        }}>
          {badge.icon}
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: badge.earned ? 'var(--near-black)' : 'var(--mid-grey)' }}>{badge.label}</p>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{badge.description}</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 40 }}>
      <div style={{ background: '#0C1021', padding: '24px 24px 22px' }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Achievements</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>{earned.length} of {badges.length} earned</p>
      </div>

      <div style={{ padding: '20px 20px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 12 }}>
          Earned · {earned.length} badges
        </p>
        {earned.length === 0 ? (
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '20px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 13, marginBottom: 20 }}>
            No badges yet. Take an exam or finish a course to earn your first one.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {earned.map(b => <BadgeCard key={b.key} badge={b} />)}
          </div>
        )}

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Locked
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {locked.map(b => <BadgeCard key={b.key} badge={b} />)}
        </div>
      </div>
    </div>
  )
}
