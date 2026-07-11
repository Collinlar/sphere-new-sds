'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { usePlanContext } from '@/lib/use-plan-context'
import { getCreatorSalesSummary, requestPayout, setPayoutDestination, type CreatorSalesSummary } from '@/lib/creator-sales'
import { createAssistRequest, getMyAssistRequests, type AssistStatus } from '@/lib/assisted-creation'

const TYPE_GRADIENT: Record<string, string> = {
  quiz: 'linear-gradient(135deg, var(--navy), #1a2240)',
  engage_game: 'linear-gradient(135deg, var(--navy), #1a2240)',
  exam: 'linear-gradient(135deg, var(--blue), #0a3a75)',
  question_bank: 'linear-gradient(135deg, var(--blue), #0a3a75)',
  training_path: 'linear-gradient(135deg, var(--violet), #1a1660)',
  train_track: 'linear-gradient(135deg, var(--violet), #1a1660)',
  course: 'linear-gradient(135deg, var(--teal), #0d5e3d)',
  guide: 'linear-gradient(135deg, var(--coral), #8f281b)',
  notes: 'linear-gradient(135deg, var(--coral), #8f281b)',
  document: 'linear-gradient(135deg, var(--coral), #8f281b)',
}

const TYPE_LABEL: Record<string, string> = {
  quiz: 'Engage', engage_game: 'Engage', exam: 'Question bank', question_bank: 'Question bank',
  training_path: 'Train track', train_track: 'Train track', course: 'Course',
  guide: 'Guide', notes: 'Notes', document: 'Document',
}

function ghs(n: number) { return `GH₵ ${n.toLocaleString()}` }
function initials(name: string) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function MySalesPage() {
  const { canSellMarketplace } = usePlanContext()
  const [summary, setSummary] = useState<CreatorSalesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState('')
  const [payoutErr, setPayoutErr] = useState('')
  const [editingDestination, setEditingDestination] = useState(false)
  const [destNumber, setDestNumber] = useState('')
  const [destSaving, setDestSaving] = useState(false)
  const [assistBrief, setAssistBrief] = useState('')
  const [assistBusy, setAssistBusy] = useState(false)
  const [assistMsg, setAssistMsg] = useState('')
  const [assistRequests, setAssistRequests] = useState<{ id: string; brief: string | null; status: AssistStatus; agreedCommissionRate: number | null; createdAt: string }[]>([])

  useEffect(() => {
    const uid = getCurrentUser().id
    getCreatorSalesSummary(uid).then(s => { setSummary(s); setLoading(false) })
    getMyAssistRequests(uid).then(setAssistRequests)
  }, [])

  async function handleAssistRequest() {
    setAssistBusy(true); setAssistMsg('')
    const result = await createAssistRequest(getCurrentUser().id, assistBrief)
    setAssistBusy(false)
    if (!result.ok) { setAssistMsg(result.error); return }
    setAssistMsg('Brief sent. Sphere will come back to you with a quote.')
    setAssistBrief('')
    getMyAssistRequests(getCurrentUser().id).then(setAssistRequests)
  }

  async function handlePayout() {
    if (!summary) return
    if (!summary.payoutMethod) { setEditingDestination(true); setPayoutErr('Add your MoMo payout number first.'); return }
    setPayoutBusy(true); setPayoutErr(''); setPayoutMsg('')
    const result = await requestPayout(getCurrentUser().id, summary.availableGhs)
    setPayoutBusy(false)
    if (!result.ok) { setPayoutErr(result.error); return }
    setPayoutMsg('Payout requested. Sphere will send it to your MoMo shortly.')
    setSummary({ ...summary, availableGhs: 0 })
  }

  async function handleSaveDestination() {
    const cleaned = destNumber.trim()
    if (!cleaned) { setPayoutErr('Enter your MTN MoMo number.'); return }
    setDestSaving(true)
    const result = await setPayoutDestination(getCurrentUser().id, 'MTN MoMo', cleaned)
    setDestSaving(false)
    if (!result.ok) { setPayoutErr(result.error); return }
    setEditingDestination(false)
    setPayoutErr('')
    if (summary) setSummary({ ...summary, payoutMethod: `MTN MoMo · ${cleaned}` })
  }

  const maxMonthly = summary ? Math.max(1, ...summary.monthly.map(m => m.earningsGhs)) : 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="My Sales"
        left={<Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>← Marketplace</Link>}
        right={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--violet)', background: 'var(--violet-light, #EEEDF8)', padding: '4px 8px', borderRadius: 5 }}>CREATOR</span>}
      />

      <div className="r-pad" style={{ padding: '24px 26px 40px', maxWidth: 1100, margin: '0 auto' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Adding up your earnings...</p>
        ) : !canSellMarketplace && summary && summary.listings.length === 0 ? (
          <div className="sphere-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>Start selling on the marketplace</p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
              Upgrade to a Creator plan to publish resources, reach learners across Ghana, and earn from what you build.
            </p>
            <Link href="/platform/settings/billing" style={{ display: 'inline-block', height: 44, lineHeight: '44px', padding: '0 24px', borderRadius: 10, background: 'var(--amber)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              See Creator plans
            </Link>
          </div>
        ) : summary && (
          <div className="sales-grid" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* LEFT column */}
            <div style={{ flex: 1.7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Navy earnings + chart */}
              <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '22px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Net earnings</p>
                    <p style={{ fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', lineHeight: 1 }}>{ghs(summary.netEarningsTotalGhs)}</p>
                  </div>
                  {summary.earningsDeltaPct != null && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', background: 'rgba(26,137,102,.2)', padding: '5px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      {summary.earningsDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(summary.earningsDeltaPct)}%
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 128, marginTop: 22, paddingTop: 14, borderTop: '.5px solid rgba(255,255,255,.1)' }}>
                  {summary.monthly.map((m, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: '100%', height: Math.max(6, Math.round((m.earningsGhs / maxMonthly) * 105)), background: m.isCurrent ? 'var(--teal)' : 'rgba(255,255,255,.16)', borderRadius: '6px 6px 0 0' }} />
                      <span style={{ fontSize: 10, fontWeight: m.isCurrent ? 600 : 400, color: m.isCurrent ? 'var(--teal)' : 'rgba(255,255,255,.4)' }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI row */}
              <div className="r-collapse-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="sphere-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Sales this month</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-.02em' }}>{summary.salesThisMonth}</p>
                  {summary.salesDeltaVsLastMonth !== 0 && (
                    <p style={{ fontSize: 11, color: summary.salesDeltaVsLastMonth > 0 ? 'var(--teal)' : 'var(--mid-grey)', fontWeight: 600, marginTop: 4 }}>
                      {summary.salesDeltaVsLastMonth > 0 ? '▲' : '▼'} {Math.abs(summary.salesDeltaVsLastMonth)} vs last month
                    </p>
                  )}
                </div>
                <div className="sphere-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Learners reached</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-.02em' }}>{summary.learnersReached.toLocaleString()}</p>
                </div>
                <div className="sphere-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Live listings</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-.02em' }}>{summary.listings.filter(l => l.status === 'approved').length}</p>
                </div>
              </div>

              {/* Listings table */}
              <div style={{ background: 'var(--white)', borderRadius: 14, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                <div style={{ padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '.5px solid var(--border)' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>Your listings</p>
                  <Link href="/platform/library" style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>Manage all</Link>
                </div>
                <div className="r-table-scroll">
                  <div style={{ minWidth: 560 }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', background: 'var(--page-bg)' }}>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Resource</span>
                      <span style={{ width: 80, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>Price</span>
                      <span style={{ width: 70, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>Sales</span>
                      <span style={{ width: 100, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>Revenue</span>
                      <span style={{ width: 96, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>Status</span>
                    </div>
                    {summary.listings.length === 0 ? (
                      <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13, color: 'var(--mid-grey)' }}>
                        You have no listings yet. Publish one from any resource you have made.
                      </div>
                    ) : summary.listings.map((l, i) => {
                      const live = l.status === 'approved'
                      return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 18px', borderBottom: i === summary.listings.length - 1 ? 'none' : '.5px solid var(--border)' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 9, background: TYPE_GRADIENT[l.resource_type] ?? TYPE_GRADIENT.course, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{TYPE_LABEL[l.resource_type] ?? l.resource_type}</p>
                            </div>
                          </div>
                          <span style={{ width: 80, fontSize: 13, fontWeight: 600, color: l.is_free ? 'var(--teal)' : 'var(--amber)', textAlign: 'right' }}>{l.is_free ? 'Free' : ghs(l.price_ghs)}</span>
                          <span style={{ width: 70, fontSize: 13, color: 'var(--near-black)', textAlign: 'right' }}>{l.sales}</span>
                          <span style={{ width: 100, fontSize: 13, fontWeight: 700, color: 'var(--near-black)', textAlign: 'right' }}>{ghs(l.revenueGhs)}</span>
                          <div style={{ width: 96, display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: live ? 'var(--teal)' : 'var(--amber)', background: live ? 'var(--teal-light)' : 'var(--amber-light)', borderRadius: 6, padding: '3px 9px' }}>
                              {live ? 'Live' : l.status === 'pending_review' ? 'In review' : l.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Payout card */}
              <div className="sphere-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Available for payout</p>
                <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-.02em', marginBottom: 2 }}>{ghs(summary.availableGhs)}</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{ghs(summary.pendingGhs)} pending clearance</p>
                {payoutErr && <p style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 10 }}>{payoutErr}</p>}
                {payoutMsg && <p style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 10 }}>{payoutMsg}</p>}
                <button
                  onClick={handlePayout}
                  disabled={payoutBusy || summary.availableGhs <= 0}
                  style={{
                    height: 46, width: '100%', border: 'none', borderRadius: 10,
                    background: summary.availableGhs > 0 ? 'var(--amber)' : 'var(--bg2)',
                    color: summary.availableGhs > 0 ? '#fff' : 'var(--mid-grey)',
                    fontSize: 14, fontWeight: 700, cursor: summary.availableGhs > 0 && !payoutBusy ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', marginBottom: 12,
                  }}
                >
                  {payoutBusy ? 'Requesting...' : 'Request payout'}
                </button>
                {editingDestination ? (
                  <div style={{ padding: '11px 12px', background: 'var(--page-bg)', borderRadius: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>MTN MoMo number</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={destNumber}
                        onChange={e => setDestNumber(e.target.value)}
                        placeholder="024 123 4567"
                        style={{ flex: 1, height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                      <button
                        onClick={handleSaveDestination}
                        disabled={destSaving}
                        style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {destSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingDestination(true); setDestNumber('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', background: 'var(--page-bg)', borderRadius: 10, border: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="4.5" width="13" height="9" rx="2" stroke="var(--teal)" strokeWidth="1.4" /><path d="M2.5 7.5h13" stroke="var(--teal)" strokeWidth="1.4" /></svg>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)' }}>{summary.payoutMethod ?? 'Set up MoMo payout'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{summary.payoutMethod ? 'Tap to change your number' : 'Add a payout number'}</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Recent sales */}
              <div style={{ background: 'var(--white)', borderRadius: 14, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                <div style={{ padding: '15px 16px 11px' }}><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>Recent sales</p></div>
                {summary.recentSales.length === 0 ? (
                  <div style={{ padding: '8px 16px 18px', fontSize: 13, color: 'var(--mid-grey)' }}>No sales yet. They will show up here the moment someone buys.</div>
                ) : summary.recentSales.map(s => (
                  <div key={s.id} style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 11, borderTop: '.5px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>{initials(s.buyerName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.listingTitle}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.buyerName} · {timeAgo(s.purchasedAt)}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>+{ghs(s.earningsGhs)}</span>
                  </div>
                ))}
              </div>

              {/* Top earner */}
              {summary.topEarner && (
                <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '16px 18px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Top earner this month</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.1)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.topEarner.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{ghs(summary.topEarner.earningsGhs)} this month</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sphere-assisted creation */}
              <div className="sphere-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)', marginBottom: 4 }}>Build it with Sphere</p>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 12 }}>
                  Short on time? The Sphere team helps you build and package a resource for the marketplace. You agree the split before any work starts.
                </p>
                {assistRequests.length > 0 && (
                  <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assistRequests.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--page-bg)', borderRadius: 8, padding: '8px 10px' }}>
                        <span style={{ fontSize: 12, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.brief ?? 'Sphere offer'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: r.status === 'delivered' ? 'var(--teal)' : r.status === 'declined' ? 'var(--coral)' : '#9A5800', flexShrink: 0 }}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {assistMsg && <p style={{ fontSize: 12, color: assistMsg.includes('did not') ? 'var(--coral)' : 'var(--teal)', marginBottom: 10 }}>{assistMsg}</p>}
                <textarea
                  value={assistBrief}
                  onChange={e => setAssistBrief(e.target.value)}
                  placeholder="What do you want built? e.g. A 40-question BECE Science mock with mark scheme"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                />
                <button
                  onClick={handleAssistRequest}
                  disabled={assistBusy || !assistBrief.trim()}
                  style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: assistBrief.trim() ? 'var(--near-black)' : 'var(--bg2)', color: assistBrief.trim() ? '#fff' : 'var(--mid-grey)', fontSize: 13, fontWeight: 600, cursor: assistBrief.trim() && !assistBusy ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                >
                  {assistBusy ? 'Sending your brief...' : 'Ask Sphere to build with me'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sales-grid { flex-direction: column !important; }
          .sales-grid > div { flex: 1 1 auto !important; width: 100%; }
        }
      `}</style>
    </div>
  )
}
