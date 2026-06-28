'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { IconCheck, IconDocument, IconPlay } from '@/components/icons'
import {
  fetchPendingResources,
  reviewResource,
  REVIEW_CHECKLIST,
  formatPrice,
  isFreeResource,
  type MarketplaceResource,
} from '@/lib/marketplace'

export default function MarketplaceReviewPage() {
  const [pending, setPending] = useState<MarketplaceResource[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<boolean[]>(REVIEW_CHECKLIST.map(() => false))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const data = await fetchPendingResources()
    setPending(data)
    if (data.length && !activeId) setActiveId(data[0].id)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = pending.find((p) => p.id === activeId) ?? pending[0] ?? null

  useEffect(() => {
    setChecklist(REVIEW_CHECKLIST.map((_, i) => i < 3))
    setNotes('')
    setError(null)
  }, [activeId])

  function toggleCheck(index: number) {
    setChecklist((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  async function handleReview(action: 'approve' | 'reject') {
    if (!active) return
    if (action === 'approve' && !checklist.every(Boolean)) {
      setError('Complete the review checklist before approving.')
      return
    }
    setActing(true)
    setError(null)
    const result = await reviewResource(active.id, action, notes.trim() || undefined)
    setActing(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const remaining = pending.filter((p) => p.id !== active.id)
    setPending(remaining)
    setActiveId(remaining[0]?.id ?? null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Marketplace review queue"
        right={
          <Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Marketplace
          </Link>
        }
      />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 18px 28px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>Review queue</span>
          </div>
          <span style={{
            background: 'var(--amber-light)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--amber)',
          }}>
            {pending.length} pending
          </span>
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading submissions for review...</p>
        ) : pending.length === 0 ? (
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            padding: '40px 24px',
            boxShadow: 'var(--shadow-soft)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
              Queue is clear
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
              No resources waiting for review right now.
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-soft)',
            overflow: 'hidden',
          }}>
            {active && (
              <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--blue-light)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: 'linear-gradient(135deg, var(--teal), #0d5e3d)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <IconDocument size={14} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2 }}>
                      {active.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {active.metadata?.creator_name ?? 'Unknown'} · {active.subject} · {active.level}
                      </span>
                      <span style={{
                        background: 'var(--teal-light)',
                        borderRadius: 20,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--teal)',
                      }}>
                        {formatPrice(active.price_ghs)}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    background: 'var(--amber-light)',
                    borderRadius: 6,
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--amber)',
                    flexShrink: 0,
                  }}>
                    Under review
                  </span>
                </div>

                {active.description && (
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.55, marginBottom: 12 }}>
                    {active.description}
                  </p>
                )}

                <div style={{ background: 'var(--page-bg)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
                  <p style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    marginBottom: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Review checklist
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {REVIEW_CHECKLIST.map((item, index) => {
                      const checked = checklist[index]
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleCheck(index)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font)',
                          }}
                        >
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            background: checked ? 'var(--teal-light)' : 'var(--bg2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {checked ? (
                              <IconCheck size={9} style={{ color: 'var(--teal)' }} />
                            ) : (
                              <span style={{ width: 8, height: 1.5, background: 'var(--text-tertiary)', display: 'block', borderRadius: 1 }} />
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: checked ? 'var(--near-black)' : 'var(--text-tertiary)' }}>
                            {item}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add reviewer notes (optional)..."
                  style={{
                    width: '100%',
                    background: 'var(--page-bg)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontFamily: 'var(--font)',
                    fontSize: 12,
                    color: 'var(--near-black)',
                    resize: 'none',
                    outline: 'none',
                    height: 52,
                    marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />

                {error && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10 }}>{error}</p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleReview('reject')}
                    disabled={acting}
                    style={{
                      flex: 1,
                      height: 40,
                      background: 'var(--coral-light)',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--coral)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReview('approve')}
                    disabled={acting}
                    style={{
                      flex: 2,
                      height: 40,
                      background: 'var(--teal)',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {acting ? 'Saving review...' : 'Approve and publish'}
                  </button>
                </div>
              </div>
            )}

            {pending.filter((p) => p.id !== active?.id).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderBottom: '0.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--white)',
                  border: 'none',
                  borderBottomWidth: '0.5px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font)',
                }}
              >
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: item.resource_type === 'engage_game' ? 'var(--navy)' : 'var(--violet-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {item.resource_type === 'engage_game' ? (
                    <IconPlay size={12} style={{ color: 'rgba(255,255,255,0.75)' }} />
                  ) : (
                    <IconDocument size={12} style={{ color: 'var(--violet)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{item.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {item.metadata?.creator_name} · {item.subject}
                    {!isFreeResource(item) ? ` · Paid · ${formatPrice(item.price_ghs)}` : ' · Free'}
                  </p>
                </div>
                <span style={{
                  background: 'var(--amber-light)',
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--amber)',
                  flexShrink: 0,
                }}>
                  Pending
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
