'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { usePlanContext } from '@/lib/use-plan-context'
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
  type MarketplaceResourceType,
} from '@/lib/marketplace'
import { getMarketplaceCreatorEligibility, type CreatorEligibility } from '@/lib/creator-eligibility'
import { getCreatorStorefrontStats, type StorefrontStats } from '@/lib/creator-sales'
import { LIBRARY_TAB_FOR_MODULE } from '@/lib/library-scope'

// Per-type visual + label for the richer result cards.
const TYPE_META: Record<string, { label: string; color: string; light: string; gradient: string }> = {
  lesson_plan:      { label: 'Lesson plan',    color: 'var(--teal)',   light: 'var(--teal-light)',   gradient: 'linear-gradient(135deg, var(--teal), #0d5e3d)' },
  question_bank:    { label: 'Question bank',  color: 'var(--blue)',   light: 'var(--blue-light)',   gradient: 'linear-gradient(135deg, var(--blue), #0a3a75)' },
  engage_game:      { label: 'Engage',         color: 'var(--violet)', light: 'var(--violet-light)', gradient: 'linear-gradient(135deg, var(--navy), #1a2240)' },
  train_track:      { label: 'Train track',    color: 'var(--violet)', light: 'var(--violet-light)', gradient: 'linear-gradient(135deg, var(--violet), #1a1660)' },
  reading_material: { label: 'Reading',        color: 'var(--coral)',  light: 'var(--coral-light)',  gradient: 'linear-gradient(135deg, var(--coral), #8f281b)' },
}

function metaFor(r: MarketplaceResource) {
  return TYPE_META[r.resource_type] ?? TYPE_META.lesson_plan
}

function hrefFor(r: MarketplaceResource, imported: boolean) {
  if (imported) return `/platform/library?tab=${LIBRARY_TAB_FOR_MODULE[moduleForMarketplaceResource(r)]}`
  return `/platform/marketplace/${r.id}`
}

type PriceFilter = 'any' | 'free' | 'paid'

export default function MarketplacePage() {
  const { canSellMarketplace, isSphereStaff } = usePlanContext()

  const [resources, setResources] = useState<MarketplaceResource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<MarketplaceResourceType | 'all'>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('any')
  const [allLevels, setAllLevels] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [topRated, setTopRated] = useState(false)
  const [licenseOnly, setLicenseOnly] = useState(false)
  const [mobileFilters, setMobileFilters] = useState(false)

  const [viewerLevelType, setViewerLevelType] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<CreatorEligibility | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [storefront, setStorefront] = useState<StorefrontStats | null>(null)

  useEffect(() => {
    const uid = getCurrentUser().id
    getViewerLevelType().then(setViewerLevelType)
    getMarketplaceCreatorEligibility(uid).then(setEligibility)
    fetchAllImportedResourceIds(uid).then(setImportedIds)
  }, [])

  useEffect(() => {
    if (canSellMarketplace) getCreatorStorefrontStats(getCurrentUser().id).then(setStorefront)
  }, [canSellMarketplace])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await fetchResources({
        search,
        type: typeFilter,
        freeOnly: priceFilter === 'free',
        viewerLevelType: allLevels ? null : viewerLevelType,
      })
      setResources(data)
      setLoading(false)
    }
    const timer = setTimeout(load, search ? 200 : 0)
    return () => clearTimeout(timer)
  }, [search, typeFilter, priceFilter, allLevels, viewerLevelType])

  // Client-side facets that fetchResources does not cover.
  const filtered = useMemo(() => {
    let items = resources
    if (priceFilter === 'paid') items = items.filter(r => !isFreeResource(r))
    if (topRated) items = items.filter(r => (r.rating_avg ?? 0) >= 4.5)
    if (verifiedOnly) items = items.filter(r => r.metadata?.verified)
    if (licenseOnly) items = items.filter(r => r.resource_type === 'train_track')
    // Owned resources sink to the bottom.
    const fresh = items.filter(r => !importedIds.has(r.id))
    const owned = items.filter(r => importedIds.has(r.id))
    return [...fresh, ...owned]
  }, [resources, priceFilter, topRated, verifiedOnly, licenseOnly, importedIds])

  const featured = filtered.find(r => r.metadata?.featured && !importedIds.has(r.id))
  const grid = filtered.filter(r => r.id !== featured?.id)

  const typeChips = FILTER_CHIPS.filter(c => c.key === 'all' || c.type)

  const levelLabel = viewerLevelType ? viewerLevelType.toUpperCase() : null
  const refineCount = (priceFilter !== 'any' ? 1 : 0) + (verifiedOnly ? 1 : 0) + (topRated ? 1 : 0) + (licenseOnly ? 1 : 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Navy hero ── */}
        <div style={{ background: 'var(--navy)', padding: '24px 28px 22px' }}>
          <div className="mkt-hero-top" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>SphereSDS · Platform</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>Marketplace</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {canSellMarketplace && storefront && (
                <Link href="/platform/marketplace/sales" style={{ display: 'flex', alignItems: 'center', gap: 20, textDecoration: 'none' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 2 }}>Earned this month</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>GH₵ {storefront.earnedThisMonthGhs.toLocaleString()}</p>
                  </div>
                  <div style={{ width: '.5px', height: 34, background: 'rgba(255,255,255,.14)' }} />
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 2 }}>Live · imports</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{storefront.liveListings} · {storefront.imports}</p>
                  </div>
                </Link>
              )}
              {canSellMarketplace ? (
                <Link href="/platform/marketplace/publish" style={{ height: 40, background: 'var(--amber)', borderRadius: 9, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" /></svg>
                  Publish resource
                </Link>
              ) : (
                <Link href="/platform/settings/billing" style={{ height: 40, background: 'rgba(255,255,255,.12)', borderRadius: 9, padding: '0 18px', display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)', textDecoration: 'none' }}>
                  Upgrade to publish
                </Link>
              )}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 11, height: 46, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 11 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" /><path d="M11 11l2.5 2.5" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons, question banks, games, tracks" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff', fontFamily: 'var(--font)', minWidth: 0 }} />
          </div>
        </div>

        {/* Creator suspension banner: upgrade first, publish-back second */}
        {eligibility?.suspended && (
          <div style={{ margin: '14px 20px 0', background: '#FDECEA', border: '1px solid #C23B2A', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#C23B2A' }}>
                Your marketplace publishing is suspended
              </p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, lineHeight: 1.5 }}>
                {eligibility.graceDaysLeft != null && eligibility.graceDaysLeft > 0
                  ? `Your listings stay live for ${eligibility.graceDaysLeft} more day${eligibility.graceDaysLeft === 1 ? '' : 's'}. `
                  : eligibility.graceDaysLeft === 0
                    ? 'Your listings have been taken down. '
                    : ''}
                Upgrade to Creator Quarterly to restore everything instantly, or publish {eligibility.shortfall} more listing{eligibility.shortfall === 1 ? '' : 's'} to earn your standing back.
              </p>
            </div>
            <Link href="/platform/settings/billing" style={{ height: 34, padding: '0 14px', borderRadius: 7, flexShrink: 0, background: '#C23B2A', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Upgrade to restore</Link>
          </div>
        )}

        {/* Creator eligibility banner (not yet suspended) */}
        {eligibility && !eligibility.suspended && eligibility.status !== 'ok' && eligibility.status !== 'not_marketplace' && (
          <div style={{ margin: '14px 20px 0', background: eligibility.status === 'lapsed' ? '#FDECEA' : '#FEF0DC', border: `1px solid ${eligibility.status === 'lapsed' ? '#C23B2A' : '#E8A020'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: eligibility.status === 'lapsed' ? '#C23B2A' : '#9A5800' }}>
                {eligibility.status === 'lapsed' ? 'Your marketplace creator standing has lapsed' : `${eligibility.shortfall} more listing${eligibility.shortfall === 1 ? '' : 's'} needed this cycle`}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, lineHeight: 1.5 }}>
                Marketplace creators publish at least {eligibility.required} resources every {eligibility.windowDays} days. You have {eligibility.creations} so far.
              </p>
            </div>
            <Link href="/platform/settings/billing" style={{ height: 34, padding: '0 14px', borderRadius: 7, flexShrink: 0, background: eligibility.status === 'lapsed' ? '#C23B2A' : 'var(--near-black)', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View plans</Link>
          </div>
        )}

        {/* ── Type: primary browse axis, full-width segmented row ── */}
        <div className="mkt-typebar" style={{ display: 'flex', gap: 7, alignItems: 'center', overflowX: 'auto', padding: '14px 22px', background: 'var(--white)', borderBottom: '.5px solid var(--border)' }}>
          {typeChips.map(c => {
            const value = (c.type ?? 'all') as MarketplaceResourceType | 'all'
            const active = typeFilter === value
            const meta = c.type ? TYPE_META[c.type] : null
            return (
              <Pill key={c.key} active={active} onClick={() => setTypeFilter(value)} color={meta?.color ?? '#fff'} light={meta?.light ?? 'var(--near-black)'}>
                {c.label}
              </Pill>
            )
          })}
        </div>

        {/* ── Results (full width) ── */}
        <div style={{ padding: '18px 22px 32px' }}>
          {/* Toolbar: count + level (left) · active refinements + Filters (right) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
                <span style={{ fontWeight: 700, color: 'var(--near-black)' }}>{filtered.length}</span> resource{filtered.length === 1 ? '' : 's'}
              </p>
              {levelLabel && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Pill active={!allLevels} onClick={() => setAllLevels(false)} color="var(--violet)" light="var(--violet-light)">{levelLabel}</Pill>
                  <Pill active={allLevels} onClick={() => setAllLevels(true)} color="var(--violet)" light="var(--violet-light)">All levels</Pill>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Active refinement chips (removable) */}
              {priceFilter !== 'any' && <RemovableChip label={priceFilter === 'free' ? 'Free' : 'Paid'} onRemove={() => setPriceFilter('any')} />}
              {verifiedOnly && <RemovableChip label="Verified" onRemove={() => setVerifiedOnly(false)} />}
              {topRated && <RemovableChip label="4.5★+" onRemove={() => setTopRated(false)} />}
              {licenseOnly && <RemovableChip label="License" onRemove={() => setLicenseOnly(false)} />}

              {/* Filters trigger + popover */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMobileFilters(v => !v)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', fontSize: 13, fontWeight: 600, color: 'var(--near-black)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  Filters
                  {refineCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: 'var(--amber)', color: '#fff', fontSize: 11, fontWeight: 700 }}>{refineCount}</span>
                  )}
                </button>
                {mobileFilters && (
                  <>
                    <div onClick={() => setMobileFilters(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div className="mkt-filter-pop" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 300, background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 16 }}>
                      <RefinementsPanel
                        priceFilter={priceFilter} setPriceFilter={setPriceFilter}
                        verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
                        topRated={topRated} setTopRated={setTopRated}
                        licenseOnly={licenseOnly} setLicenseOnly={setLicenseOnly}
                        onClear={refineCount > 0 ? () => { setPriceFilter('any'); setVerifiedOnly(false); setTopRated(false); setLicenseOnly(false) } : undefined}
                      />
                    </div>
                  </>
                )}
              </div>

              {isSphereStaff && (
                <Link href="/platform/marketplace/review" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Review queue →</Link>
              )}
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Scanning marketplace listings...</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>No resources match your filters. Try widening them.</p>
          ) : (
            <>
              {/* Featured band */}
              {featured && (
                <Link href={hrefFor(featured, false)} style={{ textDecoration: 'none' }}>
                  <div style={{ background: metaFor(featured).gradient, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: '62%', minWidth: 200 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: '#fff' }}>Editor&apos;s pick</span>
                        <span style={{ background: 'rgba(255,255,255,.12)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>{formatPrice(featured.price_ghs)}</span>
                      </div>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{featured.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
                        {featured.metadata?.creator_name ?? 'Sphere creator'}{featured.rating_count > 0 ? ` · ★ ${featured.rating_avg.toFixed(1)}` : ''} · {featured.import_count} imports
                      </p>
                    </div>
                    <span style={{ height: 42, background: '#fff', borderRadius: 9, padding: '0 20px', display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 700, color: metaFor(featured).color }}>
                      {isFreeResource(featured) ? 'Import free' : 'View'}
                    </span>
                  </div>
                </Link>
              )}

              {/* Result grid — full width, 3-up */}
              <div className="mkt-result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {grid.map(r => (
                  <ResultCard key={r.id} resource={r} imported={importedIds.has(r.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mkt-result-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .mkt-hero-top { flex-direction: column !important; }
          .mkt-result-grid { grid-template-columns: 1fr !important; }
          .mkt-filter-pop { position: fixed !important; left: 16px !important; right: 16px !important; top: auto !important; width: auto !important; }
        }
      `}</style>
    </div>
  )
}

function ResultCard({ resource, imported }: { resource: MarketplaceResource; imported: boolean }) {
  const m = metaFor(resource)
  const free = isFreeResource(resource)
  const isBulk = resource.resource_type === 'train_track'
  return (
    <Link href={hrefFor(resource, imported)} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: 14, display: 'flex', gap: 13, opacity: imported ? 0.72 : 1 }}>
        <div style={{ width: 54, height: 54, borderRadius: 11, background: m.gradient, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: m.color, background: m.light, borderRadius: 4, padding: '1px 6px' }}>{m.label}</span>
            {isBulk && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', background: 'var(--blue-light)', borderRadius: 4, padding: '1px 6px' }}>Bulk</span>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.25, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{resource.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {resource.rating_count > 0 ? `★ ${resource.rating_avg.toFixed(1)} · ` : ''}{resource.metadata?.creator_name ?? getResourceTypeLabel(resource.resource_type)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: imported ? 'var(--mid-grey)' : free ? 'var(--teal)' : 'var(--amber)', flexShrink: 0 }}>
              {imported ? 'Owned' : free ? 'Free' : formatPrice(resource.price_ghs)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

interface RefineProps {
  priceFilter: PriceFilter
  setPriceFilter: (p: PriceFilter) => void
  verifiedOnly: boolean
  setVerifiedOnly: (v: boolean) => void
  topRated: boolean
  setTopRated: (v: boolean) => void
  licenseOnly: boolean
  setLicenseOnly: (v: boolean) => void
  onClear?: () => void
}

// A removable active-filter chip shown in the toolbar.
function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px 0 12px', borderRadius: 8, background: 'var(--near-black)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </button>
    </span>
  )
}

// One pill visual language shared by every facet group — colour is the
// signal, not a checkbox plus a sentence. Inactive chips stay neutral grey;
// active chips take on the group's accent colour.
function Pill({ active, color, light, onClick, icon, children }: {
  active: boolean
  color: string
  light: string
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 30, padding: icon ? '0 12px 0 10px' : '0 12px',
        borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? light : 'var(--bg2)',
        color: active ? color : 'var(--mid-grey)',
        fontSize: 12, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 9 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  )
}

// The occasional refinements, tucked behind the Filters control.
function RefinementsPanel(p: RefineProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--near-black)' }}>Filters</p>
        {p.onClear && (
          <button onClick={p.onClear} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--amber)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Clear all</button>
        )}
      </div>

      <FacetGroup label="Price">
        {(['any', 'free', 'paid'] as PriceFilter[]).map(pf => (
          <Pill key={pf} active={p.priceFilter === pf} onClick={() => p.setPriceFilter(pf)} color="#fff" light="var(--near-black)">
            <span style={{ textTransform: 'capitalize' }}>{pf}</span>
          </Pill>
        ))}
      </FacetGroup>

      <FacetGroup label="Trust">
        <Pill
          active={p.verifiedOnly} onClick={() => p.setVerifiedOnly(!p.verifiedOnly)}
          color="var(--teal)" light="var(--teal-light)"
          icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1l4 1.5v3c0 2.8-1.7 4.6-4 5.5-2.3-.9-4-2.7-4-5.5v-3L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M4.3 6l1.2 1.2L7.9 4.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        >
          Verified
        </Pill>
        <Pill
          active={p.topRated} onClick={() => p.setTopRated(!p.topRated)}
          color="var(--amber)" light="var(--amber-light)"
          icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0.5l1.5 3.2 3.5.4-2.6 2.4.7 3.5L6 8.3 2.9 10l.7-3.5L1 4.1l3.5-.4L6 .5z" /></svg>}
        >
          4.5★+
        </Pill>
        <Pill
          active={p.licenseOnly} onClick={() => p.setLicenseOnly(!p.licenseOnly)}
          color="var(--blue)" light="var(--blue-light)"
          icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 10V5l4-2.5L10 5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.3 10V6.8h3.4V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        >
          License
        </Pill>
      </FacetGroup>
    </>
  )
}
