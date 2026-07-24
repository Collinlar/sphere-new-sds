'use client'

import { useEffect, useState, use, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import ImportDestinationPicker, { useImportDestination } from '@/components/brand/ImportDestinationPicker'
import { IconCheck } from '@/components/icons'
import { getCurrentUser } from '@/lib/auth'
import { destinationInstitutionId, destinationKey, destinationLabel } from '@/lib/library-scope'
import type { ImportDestination } from '@/lib/library-scope'
import {
  fetchResourceById,
  fetchResourceReviews,
  importResource,
  hasImported,
  findImportedDestinations,
  findImportedContent,
  formatPrice,
  isFreeResource,
  getResourceTypeLabel,
  type MarketplaceResource,
  type MarketplaceReview,
} from '@/lib/marketplace'
import { startCheckout, verifyCheckoutReference } from '@/lib/checkout-client'
import {
  formatReceiptAmount,
  usePathForImportedTarget,
  type MarketplacePurchaseReceipt,
} from '@/lib/marketplace-receipt'

const ACCENT_GRADIENTS: Record<string, string> = {
  teal: 'linear-gradient(135deg, #1A8966 0%, #0d5e3d 100%)',
  navy: 'linear-gradient(135deg, var(--navy) 0%, #1a2240 100%)',
  violet: 'linear-gradient(135deg, #2E2886 0%, #1a1660 100%)',
  amber: 'linear-gradient(135deg, #D97010 0%, #9A5800 100%)',
  blue: 'linear-gradient(135deg, #1052A3 0%, #0a3468 100%)',
}

export default function MarketplaceResourcePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <MarketplaceResourcePageInner paramsPromise={paramsPromise} />
    </Suspense>
  )
}

function MarketplaceResourcePageInner({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const searchParams = useSearchParams()
  const [resource, setResource] = useState<MarketplaceResource | null>(null)
  const [reviews, setReviews] = useState<MarketplaceReview[]>([])
  const [imported, setImported] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importDestination, setImportDestination] = useImportDestination()
  const [otherShelfImports, setOtherShelfImports] = useState<ImportDestination[]>([])
  const [receipt, setReceipt] = useState<MarketplacePurchaseReceipt | null>(null)
  const [useNowHref, setUseNowHref] = useState<string | null>(null)
  const [useNowLabel, setUseNowLabel] = useState<string | null>(null)

  useEffect(() => {
    const reference = searchParams.get('reference')
    if (!reference) return

    verifyCheckoutReference(reference).then(async (result) => {
      if (result.ok) {
        setImported(true)
        if (result.receipt) {
          setReceipt(result.receipt)
          setUseNowHref(result.receipt.useHref)
          setUseNowLabel(result.receipt.useLabel)
          setMessage(null)
        } else {
          setMessage('Purchase confirmed. This resource is now in your library.')
        }
        window.history.replaceState({}, '', `/platform/marketplace/${params.id}`)
      } else {
        setError(result.error)
      }
    })
  }, [searchParams, params.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [res, rev] = await Promise.all([
        fetchResourceById(params.id),
        fetchResourceReviews(params.id),
      ])
      if (cancelled) return
      setResource(res)
      setReviews(rev)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [params.id])

  useEffect(() => {
    let cancelled = false
    async function checkImported() {
      const user = getCurrentUser()
      const [done, shelves] = await Promise.all([
        hasImported(params.id, importDestination, user.id),
        findImportedDestinations(params.id, user.id),
      ])
      if (cancelled) return
      setImported(done)
      const currentKey = destinationKey(importDestination)
      setOtherShelfImports(
        shelves.filter((s) => destinationKey(s) !== currentKey)
      )

      if (done && !useNowHref) {
        const copy = await findImportedContent(params.id, importDestination, user.id)
        if (cancelled || !copy) return
        const use = usePathForImportedTarget(copy.targetType, copy.targetId)
        if (use) {
          setUseNowHref(use.href)
          setUseNowLabel(use.label)
        }
      }
    }
    checkImported()
    return () => { cancelled = true }
  }, [params.id, destinationKey(importDestination), useNowHref])

  async function handleImport() {
    if (!resource) return
    setImporting(true)
    setError(null)
    setMessage(null)
    setReceipt(null)
    const user = getCurrentUser()
    const result = await importResource(resource.id, user.id, importDestination)
    setImporting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setImported(true)
    setOtherShelfImports([])
    const use = usePathForImportedTarget(result.targetType, result.targetId)
    if (use) {
      setUseNowHref(use.href)
      setUseNowLabel(use.label)
    }
    setMessage(`Copied to ${destinationLabel(importDestination)}. Ready to use.`)
  }

  async function handleBuy() {
    if (!resource) return
    setBuying(true)
    setError(null)
    setMessage(null)
    const institutionId = destinationInstitutionId(importDestination)
    const result = await startCheckout({
      intentType: 'marketplace',
      payload: {
        listingId: resource.id,
        institutionId: institutionId ?? undefined,
        importDestinationKind: importDestination.kind,
      },
      callbackPath: `/platform/marketplace/${resource.id}`,
    })
    setBuying(false)
    if (!result.ok) setError(result.error)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Marketplace" />
        <p style={{ padding: '28px 32px', fontSize: 14, color: 'var(--mid-grey)' }}>Opening resource details...</p>
      </div>
    )
  }

  if (!resource) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="platform" title="Marketplace" />
        <div style={{ padding: '28px 32px' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Resource not found</p>
          <Link href="/platform/marketplace" style={{ fontSize: 14, color: 'var(--amber)', textDecoration: 'none' }}>
            Back to marketplace
          </Link>
        </div>
      </div>
    )
  }

  const free = isFreeResource(resource)
  const accent = resource.metadata?.accent ?? 'teal'
  const gradient = ACCENT_GRADIENTS[accent] ?? ACCENT_GRADIENTS.teal
  const stats = resource.metadata?.stats ?? {}
  const includes = resource.metadata?.includes ?? []
  const creatorName = resource.metadata?.creator_name ?? 'SphereSDS creator'
  const creatorInitials = resource.metadata?.creator_initials ?? '??'
  const creatorSlug = resource.metadata?.creator_slug

  const statCards = [
    stats.lessons != null ? { value: String(stats.lessons), label: 'Lessons' } : null,
    stats.estimated_hours != null ? { value: `${stats.estimated_hours}h`, label: 'Est. time' } : null,
    stats.questions != null ? { value: String(stats.questions), label: 'Questions' } : null,
    stats.exams != null ? { value: String(stats.exams), label: 'Exams' } : null,
    resource.level ? { value: resource.level, label: 'Level' } : null,
    { value: String(resource.import_count), label: 'Imports' },
  ].filter(Boolean) as { value: string; label: string }[]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Resource detail"
        right={
          <Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Back
          </Link>
        }
      />

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: gradient, padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
            {resource.subject && (
              <span style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: '#fff',
              }}>
                {resource.subject}
              </span>
            )}
            <span style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
            }}>
              {getResourceTypeLabel(resource.resource_type)}
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
            }}>
              {formatPrice(resource.price_ghs)}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {resource.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
              }}>
                {creatorInitials}
              </div>
              {creatorSlug ? (
                <Link href={`/c/${creatorSlug}`} style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
                  {creatorName}
                  {resource.metadata?.verified ? ' · Verified teacher' : ''}
                </Link>
              ) : (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {creatorName}
                  {resource.metadata?.verified ? ' · Verified teacher' : ''}
                </span>
              )}
            </div>
            {resource.rating_count > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 14, color: 'var(--amber)' }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{resource.rating_avg.toFixed(1)}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>({resource.rating_count} reviews)</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 22px 32px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {statCards.slice(0, 4).map((s) => (
              <div key={s.label} style={{
                flex: '1 1 80px',
                background: 'var(--white)',
                borderRadius: 9,
                padding: 12,
                boxShadow: 'var(--shadow-soft)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: s.label === 'Imports' ? 'var(--teal)' : 'var(--near-black)' }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {resource.description && (
            <div style={{
              background: 'var(--white)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: 'var(--shadow-soft)',
              marginBottom: 12,
            }}>
              <p style={{ fontSize: 13, color: 'var(--near-black)', lineHeight: 1.65 }}>{resource.description}</p>
            </div>
          )}

          {includes.length > 0 && (
            <div style={{
              background: 'var(--white)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: 'var(--shadow-soft)',
              marginBottom: 12,
            }}>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                What&apos;s included
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {includes.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconCheck size={12} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--near-black)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviews.length > 0 && (
            <div style={{
              background: 'var(--white)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: 'var(--shadow-soft)',
              marginBottom: 16,
            }}>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Top reviews
              </p>
              {reviews.map((rev) => (
                <div key={rev.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--teal-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'var(--teal)',
                    }}>
                      AM
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)' }}>Abena M.</span>
                    {rev.rating && (
                      <span style={{ fontSize: 11, color: 'var(--amber)' }}>
                        {'★'.repeat(rev.rating)}
                      </span>
                    )}
                  </div>
                  {rev.body && (
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>{rev.body}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {resource.resource_type === 'train_track' && (
            <Link href="/platform/settings/billing/institution" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--blue-light)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 17V8l7-4 7 4v9" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 17v-5h6v5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>Institution license</p>
                    <p style={{ fontSize: 11, color: 'var(--blue)', opacity: 0.75 }}>Roll out to a whole department</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', flexShrink: 0 }}>Get quote →</span>
              </div>
            </Link>
          )}

          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{error}</p>
          )}
          {message && !receipt && (
            <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 12 }}>{message}</p>
          )}

          {receipt && (
            <div style={{
              background: 'var(--white)',
              borderRadius: 12,
              padding: '16px 18px',
              boxShadow: 'var(--shadow-soft)',
              marginBottom: 14,
              border: '1px solid var(--teal-light)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconCheck size={16} style={{ color: 'var(--teal)' }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>Payment receipt</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Resource</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', textAlign: 'right' }}>{receipt.listingTitle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Amount paid</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--near-black)' }}>{formatReceiptAmount(receipt.amountGhs)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Reference</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', wordBreak: 'break-all', textAlign: 'right' }}>{receipt.reference}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Saved to</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)' }}>{receipt.destinationLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Paid at</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)' }}>
                    {new Date(receipt.purchasedAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
                Paid via MTN MoMo or card through Paystack. Keep this reference for your records.
              </p>
            </div>
          )}

          {!imported && otherShelfImports.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 12, lineHeight: 1.5 }}>
              Already in {otherShelfImports.map((s) => destinationLabel(s)).join(' and ')}.
              Import here too if you want a copy on this shelf.
            </p>
          )}

          {!imported && (
            <ImportDestinationPicker
              value={importDestination}
              onChange={setImportDestination}
              compact
            />
          )}

          {imported && useNowHref && useNowLabel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link
                href={useNowHref}
                style={{
                  width: '100%',
                  height: 50,
                  background: 'var(--teal)',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontFamily: 'var(--font)',
                }}
              >
                {useNowLabel} now
              </Link>
              <Link
                href="/platform/library"
                style={{
                  width: '100%',
                  height: 44,
                  background: 'var(--white)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--near-black)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                }}
              >
                Open my library
              </Link>
            </div>
          ) : free ? (
            <button
              onClick={handleImport}
              disabled={importing || imported}
              style={{
                width: '100%',
                height: 50,
                background: imported ? 'var(--bg2)' : 'var(--teal)',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                color: imported ? 'var(--mid-grey)' : '#fff',
                cursor: imported ? 'default' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {imported ? 'Already in your library' : importing ? 'Copying to your library...' : 'Import to my library — Free'}
            </button>
          ) : (
            <div>
              <button
                onClick={handleBuy}
                disabled={buying || imported}
                style={{
                  width: '100%',
                  height: 50,
                  background: imported ? 'var(--bg2)' : 'var(--amber)',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: imported ? 'var(--mid-grey)' : '#fff',
                  cursor: imported || buying ? 'default' : 'pointer',
                  fontFamily: 'var(--font)',
                  marginBottom: 8,
                }}
              >
                {imported ? 'Already in your library' : buying ? 'Opening MoMo checkout...' : `Buy with MoMo — ${formatPrice(resource.price_ghs)}`}
              </button>
              {!imported && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Paid via MTN MoMo or card through Paystack
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
