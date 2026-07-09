'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { IconSearch, IconDocument, IconPlay, IconUser } from '@/components/icons'
import {
  fetchResources,
  fetchAllImportedResourceIds,
  getViewerLevelType,
  moduleForMarketplaceResource,
  FILTER_CHIPS,
  formatPrice,
  isFreeResource,
  getResourceTypeLabel,
  type MarketplaceResource,
} from '@/lib/marketplace'
import { usePlanContext } from '@/lib/use-plan-context'
import { getMarketplaceCreatorEligibility, type CreatorEligibility } from '@/lib/creator-eligibility'
import { getCurrentUser } from '@/lib/auth'
import { LIBRARY_TAB_FOR_MODULE } from '@/lib/library-scope'

const ACCENT_GRADIENTS: Record<string, string> = {
  teal: 'linear-gradient(135deg, #1A8966 0%, #0d5e3d 100%)',
  navy: 'linear-gradient(135deg, var(--navy) 0%, #1a2240 100%)',
  violet: 'linear-gradient(135deg, #2E2886 0%, #1a1660 100%)',
  amber: 'linear-gradient(135deg, #D97010 0%, #9A5800 100%)',
  blue: 'linear-gradient(135deg, #1052A3 0%, #0a3468 100%)',
}

function ResourceThumb({ resource }: { resource: MarketplaceResource }) {
  const accent = resource.metadata?.accent ?? 'teal'
  const gradient = ACCENT_GRADIENTS[accent] ?? ACCENT_GRADIENTS.teal

  return (
    <div style={{
      height: 80,
      background: gradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {resource.resource_type === 'engage_game' ? (
        <IconPlay size={28} style={{ color: 'rgba(255,255,255,0.65)' }} />
      ) : resource.resource_type === 'train_track' ? (
        <IconUser size={28} style={{ color: 'rgba(255,255,255,0.65)' }} />
      ) : (
        <IconDocument size={28} style={{ color: 'rgba(255,255,255,0.65)' }} />
      )}
    </div>
  )
}

function RatingDisplay({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
      <span style={{ fontSize: 14, color: 'var(--amber)', lineHeight: 1 }}>★</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)' }}>{avg.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({count})</span>
    </div>
  )
}

function FeaturedCard({ resource, imported }: { resource: MarketplaceResource; imported: boolean }) {
  const free = isFreeResource(resource)
  const typeLabel = resource.resource_type === 'engage_game'
    ? 'Engage'
    : resource.resource_type === 'train_track'
      ? 'Train'
      : resource.subject ?? getResourceTypeLabel(resource.resource_type)

  const libraryTab = LIBRARY_TAB_FOR_MODULE[moduleForMarketplaceResource(resource)]
  const href = imported ? `/platform/library?tab=${libraryTab}` : `/platform/marketplace/${resource.id}`

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--white)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
        height: '100%',
        opacity: imported ? 0.72 : 1,
      }}>
        <ResourceThumb resource={resource} />
        <div style={{ padding: 12 }}>
          <div style={{ marginBottom: 5 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: resource.resource_type === 'engage_game' ? 'var(--navy)' : 'var(--teal-light)',
              color: resource.resource_type === 'engage_game' ? 'rgba(255,255,255,0.85)' : 'var(--teal)',
            }}>
              {typeLabel}
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4, lineHeight: 1.3 }}>
            {resource.title}
          </p>
          <RatingDisplay avg={resource.rating_avg} count={resource.rating_count} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              color: free ? 'var(--teal)' : 'var(--amber)',
            }}>
              {formatPrice(resource.price_ghs)}
            </span>
            <span style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 600,
              background: imported ? 'var(--bg2)' : free ? 'var(--teal-light)' : 'var(--amber-light)',
              color: imported ? 'var(--mid-grey)' : free ? 'var(--teal)' : 'var(--amber)',
            }}>
              {imported ? 'In your library' : free ? 'Import' : 'Buy'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ListRow({ resource, imported }: { resource: MarketplaceResource; imported: boolean }) {
  const free = isFreeResource(resource)
  const libraryTab = LIBRARY_TAB_FOR_MODULE[moduleForMarketplaceResource(resource)]
  const href = imported ? `/platform/library?tab=${libraryTab}` : `/platform/marketplace/${resource.id}`
  const meta = resource.metadata?.stats
  const detail = [
    meta?.questions ? `${meta.questions} questions` : null,
    meta?.exams ? `${meta.exams} exams` : null,
    resource.metadata?.creator_name ? `By ${resource.metadata.creator_name}` : null,
    resource.rating_count > 0 ? `★ ${resource.rating_avg.toFixed(1)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--white)',
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: 'var(--shadow-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: imported ? 0.72 : 1,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: free ? 'var(--teal-light)' : 'var(--amber-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconDocument size={16} style={{ color: free ? 'var(--teal)' : 'var(--amber)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', marginBottom: 2 }}>
            {resource.title}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{detail}</p>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: imported ? 'var(--mid-grey)' : free ? 'var(--teal)' : 'var(--amber)', flexShrink: 0 }}>
          {imported ? 'In library' : formatPrice(resource.price_ghs)}
        </p>
      </div>
    </Link>
  )
}

export default function MarketplacePage() {
  const [resources, setResources] = useState<MarketplaceResource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeChip, setActiveChip] = useState('all')
  const { canSellMarketplace, isSphereStaff } = usePlanContext()

  const [viewerLevelType, setViewerLevelType] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<CreatorEligibility | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getViewerLevelType().then(setViewerLevelType)
    getMarketplaceCreatorEligibility(getCurrentUser().id).then(setEligibility)
    fetchAllImportedResourceIds(getCurrentUser().id).then(setImportedIds)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const chip = FILTER_CHIPS.find((c) => c.key === activeChip)
      const data = await fetchResources({
        search,
        type: chip?.type ?? 'all',
        freeOnly: chip?.freeOnly,
        viewerLevelType,
      })
      setResources(data)
      setLoading(false)
    }
    const timer = setTimeout(load, search ? 200 : 0)
    return () => clearTimeout(timer)
  }, [search, activeChip, viewerLevelType])

  function sortImportedLast(items: MarketplaceResource[]) {
    const fresh = items.filter((r) => !importedIds.has(r.id))
    const owned = items.filter((r) => importedIds.has(r.id))
    return [...fresh, ...owned]
  }

  const featured = useMemo(
    () => sortImportedLast(resources.filter((r) => r.metadata?.featured)).slice(0, 3),
    [resources, importedIds]
  )

  const recent = useMemo(
    () => sortImportedLast(resources.filter((r) => !r.metadata?.featured)).slice(0, 6),
    [resources, importedIds]
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Marketplace" />

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          background: 'var(--navy)',
          padding: '28px 28px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 5,
              }}>
                SphereSDS
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                Marketplace
              </p>
            </div>
            {canSellMarketplace ? (
              <Link href="/platform/marketplace/publish" style={{
                height: 38,
                background: 'var(--amber)',
                borderRadius: 8,
                padding: '0 18px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                textDecoration: 'none',
                flexShrink: 0,
              }}>
                + Publish resource
              </Link>
            ) : (
              <Link href="/platform/settings/billing" style={{
                height: 38,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '0 18px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                flexShrink: 0,
              }}>
                Upgrade to publish
              </Link>
            )}
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 10,
          }}>
            <IconSearch size={15} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons, question banks, games…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: '#fff',
                fontFamily: 'var(--font)',
                minWidth: 0,
              }}
            />
          </div>
        </div>

        <div style={{
          background: 'var(--white)',
          padding: '12px 20px',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
        }}>
          {FILTER_CHIPS.map((chip) => {
            const active = activeChip === chip.key
            return (
              <button
                key={chip.key}
                onClick={() => setActiveChip(chip.key)}
                style={{
                  height: 32,
                  background: active ? 'var(--near-black)' : 'var(--bg2)',
                  borderRadius: 20,
                  padding: '0 14px',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#fff' : 'var(--mid-grey)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {eligibility && eligibility.status !== 'ok' && eligibility.status !== 'not_marketplace' && (
          <div style={{
            margin: '14px 20px 0',
            background: eligibility.status === 'lapsed' ? '#FDECEA' : '#FEF0DC',
            border: `1px solid ${eligibility.status === 'lapsed' ? '#C23B2A' : '#E8A020'}`,
            borderRadius: 10, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: eligibility.status === 'lapsed' ? '#C23B2A' : '#9A5800' }}>
                {eligibility.status === 'lapsed'
                  ? `Your marketplace creator standing has lapsed`
                  : `${eligibility.shortfall} more listing${eligibility.shortfall === 1 ? '' : 's'} needed this cycle`}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, lineHeight: 1.5 }}>
                Marketplace creators publish at least {eligibility.required} resources every {eligibility.windowDays} days. You have {eligibility.creations} so far.
                {eligibility.status === 'lapsed'
                  ? ' Publish more to restore your standing, or switch to Creator Quarterly.'
                  : ` Keep publishing to stay active.`}
              </p>
            </div>
            <Link href="/platform/settings/billing" style={{
              height: 34, padding: '0 14px', borderRadius: 7, flexShrink: 0,
              background: eligibility.status === 'lapsed' ? '#C23B2A' : 'var(--near-black)',
              color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>
              View plans
            </Link>
          </div>
        )}

        <div style={{ padding: '18px 20px 28px' }}>
          {loading ? (
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Scanning marketplace listings...</p>
          ) : resources.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>No resources match your search. Try a different filter.</p>
          ) : (
            <>
              {featured.length > 0 && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 14 }}>
                    Featured this week
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 10,
                    marginBottom: 22,
                  }}>
                    {featured.map((r) => (
                      <FeaturedCard key={r.id} resource={r} imported={importedIds.has(r.id)} />
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Recently added</p>
                {isSphereStaff && (
                  <Link href="/platform/marketplace/review" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 500, textDecoration: 'none' }}>
                    Review queue →
                  </Link>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(recent.length > 0 ? recent : sortImportedLast(resources)).map((r) => (
                  <ListRow key={r.id} resource={r} imported={importedIds.has(r.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
