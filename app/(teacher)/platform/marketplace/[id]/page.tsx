'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { IconCheck } from '@/components/icons'
import { getCurrentUser } from '@/lib/auth'
import {
  fetchResourceById,
  fetchResourceReviews,
  importResource,
  hasImported,
  formatPrice,
  isFreeResource,
  getResourceTypeLabel,
  type MarketplaceResource,
  type MarketplaceReview,
} from '@/lib/marketplace'

const ACCENT_GRADIENTS: Record<string, string> = {
  teal: 'linear-gradient(135deg, #1A8966 0%, #0d5e3d 100%)',
  navy: 'linear-gradient(135deg, var(--navy) 0%, #1a2240 100%)',
  violet: 'linear-gradient(135deg, #2E2886 0%, #1a1660 100%)',
  amber: 'linear-gradient(135deg, #D97010 0%, #9A5800 100%)',
  blue: 'linear-gradient(135deg, #1052A3 0%, #0a3468 100%)',
}

export default function MarketplaceResourcePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [resource, setResource] = useState<MarketplaceResource | null>(null)
  const [reviews, setReviews] = useState<MarketplaceReview[]>([])
  const [imported, setImported] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const user = getCurrentUser()
      const [res, rev, done] = await Promise.all([
        fetchResourceById(params.id),
        fetchResourceReviews(params.id),
        hasImported(params.id, user.institution_id),
      ])
      setResource(res)
      setReviews(rev)
      setImported(done)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleImport() {
    if (!resource) return
    setImporting(true)
    setError(null)
    setMessage(null)
    const user = getCurrentUser()
    const result = await importResource(resource.id, user.id, user.institution_id)
    setImporting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setImported(true)
    setMessage(`Copied to your library as a ${result.targetType.replace('_', ' ')}.`)
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
                {resource.metadata?.creator_initials ?? '??'}
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                {resource.metadata?.creator_name ?? 'SphereSDS creator'}
                {resource.metadata?.verified ? ' · Verified teacher' : ''}
              </span>
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

          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{error}</p>
          )}
          {message && (
            <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 12 }}>{message}</p>
          )}

          {free ? (
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
                disabled
                style={{
                  width: '100%',
                  height: 50,
                  background: 'var(--bg2)',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--mid-grey)',
                  cursor: 'not-allowed',
                  fontFamily: 'var(--font)',
                  marginBottom: 8,
                }}
              >
                Buy — {formatPrice(resource.price_ghs)}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Paid checkout coming soon
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
