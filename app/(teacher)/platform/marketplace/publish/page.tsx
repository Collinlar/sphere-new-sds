'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import PublishToMarketplaceModal from '@/components/brand/PublishToMarketplaceModal'
import { usePlanContext } from '@/lib/use-plan-context'
import {
  fetchPublishableResources,
  MODE_META,
  type PublishableMode,
  type PublishableResourceRow,
} from '@/lib/publishable-resources'

const MODE_FILTERS: { key: 'all' | PublishableMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'engage', label: 'Engage' },
  { key: 'assess', label: 'Assess' },
  { key: 'learn', label: 'Learn' },
  { key: 'train', label: 'Train' },
]

export default function PublishMarketplacePage() {
  const { canSellMarketplace, loading: planLoading, planId } = usePlanContext()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<PublishableResourceRow[]>([])
  const [filter, setFilter] = useState<'all' | PublishableMode>('all')
  const [selected, setSelected] = useState<PublishableResourceRow | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!canSellMarketplace) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPublishableResources()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [canSellMarketplace, reloadKey])

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.mode === filter)),
    [items, filter]
  )

  const readyCount = items.filter(i => i.isReady && !i.isListed).length

  if (planLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Publish to marketplace" />
        <p style={{ padding: 32, fontSize: 14, color: 'var(--mid-grey)' }}>Checking your plan...</p>
      </div>
    )
  }

  if (!canSellMarketplace) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Publish to marketplace" />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '32px 28px', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>
              Publishing needs a Creator plan
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 20 }}>
              Your {planId === 'membership' ? 'Membership' : 'current'} plan lets you browse and import resources.
              Upgrade to Creator Quarterly or Institution to publish and sell on the marketplace.
            </p>
            <Link
              href="/platform/settings/billing"
              style={{
                display: 'inline-flex', height: 44, alignItems: 'center', padding: '0 20px',
                borderRadius: 8, background: '#2E2886', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}
            >
              See Creator plans
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Publish to marketplace"
        left={
          <Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Marketplace
          </Link>
        }
      />

      <div style={{ padding: '28px 32px 60px', maxWidth: 820 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>
            List something you already built
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.65, maxWidth: 620 }}>
            Marketplace listings point at your Engage quizzes, Assess exams, Learn courses and resources, and Train paths.
            Build in the mode first, publish it there, then pick it below to set price and submit for review.
          </p>
        </div>

        <div style={{
          background: '#FFF8ED', border: '0.5px solid #D97010', borderRadius: 10,
          padding: '14px 16px', marginBottom: 24, fontSize: 13, color: '#7A4A00', lineHeight: 1.6,
        }}>
          <strong style={{ fontWeight: 600 }}>How it works:</strong> Create in Engage, Assess, Learn, or Train → publish inside that mode → return here to list it for sale. Buyers import the live resource, not attached files.
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {MODE_FILTERS.map(chip => {
            const active = filter === chip.key
            const accent = chip.key === 'all' ? 'var(--near-black)' : MODE_META[chip.key as PublishableMode]?.color ?? 'var(--near-black)'
            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 20, border: 'none',
                  background: active ? accent : 'var(--white)',
                  color: active ? '#fff' : 'var(--mid-grey)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: active ? 'none' : 'var(--shadow-soft)',
                }}
              >
                {chip.label}
              </button>
            )
          })}
          {!loading && readyCount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--teal)', alignSelf: 'center', marginLeft: 4 }}>
              {readyCount} ready to list
            </span>
          )}
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading your resources...</p>
        ) : filtered.length === 0 ? (
          <div className="sphere-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
              Nothing to list yet
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 20, lineHeight: 1.6 }}>
              Create a quiz, exam, course, or training path in one of the modes, publish it there, then come back to list it.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/engage/builder" style={{ fontSize: 13, fontWeight: 600, color: '#D97010', textDecoration: 'none' }}>Build in Engage</Link>
              <Link href="/assess/create" style={{ fontSize: 13, fontWeight: 600, color: '#C23B2A', textDecoration: 'none' }}>Build in Assess</Link>
              <Link href="/learn/builder" style={{ fontSize: 13, fontWeight: 600, color: '#1A8966', textDecoration: 'none' }}>Build in Learn</Link>
              <Link href="/train/builder" style={{ fontSize: 13, fontWeight: 600, color: '#1052A3', textDecoration: 'none' }}>Build in Train</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(item => {
              const accent = MODE_META[item.mode].color
              return (
                <div
                  key={`${item.resourceType}-${item.id}`}
                  style={{
                    background: 'var(--white)', borderRadius: 10, padding: '16px 18px',
                    boxShadow: 'var(--shadow-soft)', display: 'flex', alignItems: 'center',
                    gap: 14, flexWrap: 'wrap',
                    opacity: item.isReady ? 1 : 0.72,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: accent, background: `${accent}18`, padding: '2px 8px', borderRadius: 4,
                      }}>
                        {item.modeLabel}
                      </span>
                      {item.isListed && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#1A8966', background: '#DDFAF0', padding: '2px 8px', borderRadius: 4 }}>
                          On marketplace
                        </span>
                      )}
                      {!item.isReady && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mid-grey)' }}>Not ready</span>
                      )}
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2 }}>{item.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                      {item.subject ?? 'No subject'} · {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    {!item.isReady && item.readyHint && (
                      <p style={{ fontSize: 12, color: '#9A5800', marginTop: 6 }}>{item.readyHint}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={item.editHref} style={{
                      height: 36, padding: '0 14px', borderRadius: 7, border: '1px solid var(--border)',
                      background: 'var(--white)', fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)',
                      textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                    }}>
                      Open in {item.modeLabel}
                    </Link>
                    <button
                      onClick={() => setSelected(item)}
                      disabled={!item.isReady}
                      style={{
                        height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
                        background: item.isReady ? accent : 'var(--bg2)',
                        color: item.isReady ? '#fff' : 'var(--mid-grey)',
                        fontSize: 12, fontWeight: 600, cursor: item.isReady ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                      }}
                    >
                      {item.isListed ? 'Manage listing' : 'List on marketplace'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <PublishToMarketplaceModal
          open={!!selected}
          onClose={() => setSelected(null)}
          onPublished={() => {
            setSelected(null)
            setReloadKey(k => k + 1)
          }}
          resourceType={selected.resourceType}
          resourceId={selected.id}
          defaultTitle={selected.title}
          defaultDescription={selected.description}
          defaultSubject={selected.subject}
          defaultColor={selected.color}
        />
      )}
    </div>
  )
}
