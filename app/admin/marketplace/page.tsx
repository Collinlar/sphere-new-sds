'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'pending' | 'listings' | 'revenue'

interface CreatorProfile {
  id: string
  user_id: string
  slug: string
  bio?: string
  tagline?: string
  banner_color: string
  is_approved: boolean
  rejected_at?: string
  created_at: string
  users?: { name: string; email: string }
}

interface Listing {
  id: string
  title: string
  resource_type: string
  price_ghs: number
  is_free: boolean
  status: string
  commission_rate?: number
  created_at: string
  rejection_note?: string
  creator_profiles?: { slug: string; users?: { name: string } }
}

interface Purchase {
  id: string
  amount_ghs: number
  sphere_commission_ghs: number
  created_at: string
  marketplace_listings?: { title: string }
  buyer_id?: string
}

const TYPE_LABEL: Record<string, string> = {
  course: 'Course', exam: 'Exam', quiz: 'Engage', guide: 'Guide',
  notes: 'Notes', document: 'Document', training_path: 'Training path',
}

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [creators, setCreators] = useState<CreatorProfile[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [listingFilter, setListingFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const [{ data: creatorData }, { data: listingData }, { data: purchaseData }] = await Promise.all([
        supabase.from('creator_profiles').select('*, users(name, email)').order('created_at', { ascending: false }),
        supabase.from('marketplace_listings').select('*, creator_profiles(slug, users(name))').order('created_at', { ascending: false }),
        supabase.from('marketplace_purchases').select('*, marketplace_listings(title)').order('created_at', { ascending: false }).limit(200),
      ])
      setCreators((creatorData ?? []) as CreatorProfile[])
      setListings((listingData ?? []) as Listing[])
      setPurchases((purchaseData ?? []) as Purchase[])
      setLoading(false)
    }
    load()
  }, [])

  async function approveCreator(creatorId: string) {
    await supabase.from('creator_profiles').update({ is_approved: true, approved_at: new Date().toISOString(), rejected_at: null }).eq('id', creatorId)
    setCreators(prev => prev.map(c => c.id === creatorId ? { ...c, is_approved: true } : c))
    flash('Creator profile approved.')
  }

  async function rejectCreator(creatorId: string, note: string) {
    await supabase.from('creator_profiles').update({ is_approved: false, rejected_at: new Date().toISOString(), rejection_note: note }).eq('id', creatorId)
    setCreators(prev => prev.map(c => c.id === creatorId ? { ...c, rejected_at: new Date().toISOString() } : c))
    flash('Creator profile rejected.')
  }

  async function approveListing(listingId: string) {
    await supabase.from('marketplace_listings').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', listingId)
    setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'approved' } : l))
    flash('Listing approved.')
  }

  async function rejectListing(listingId: string, note: string) {
    await supabase.from('marketplace_listings').update({ status: 'rejected', rejection_note: note, reviewed_at: new Date().toISOString() }).eq('id', listingId)
    setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'rejected', rejection_note: note } : l))
    flash('Listing rejected.')
  }

  async function delistListing(listingId: string) {
    await supabase.from('marketplace_listings').update({ status: 'delisted' }).eq('id', listingId)
    setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'delisted' } : l))
    flash('Listing delisted.')
  }

  function flash(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3000)
  }

  const pendingCreators = creators.filter(c => !c.is_approved && !c.rejected_at)
  const pendingListings = listings.filter(l => l.status === 'pending')

  const filteredListings = listingFilter === 'all' ? listings : listings.filter(l => l.status === listingFilter)

  const totalRevenue = purchases.reduce((s, p) => s + (p.sphere_commission_ghs ?? 0), 0)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const revenueThisMonth = purchases.filter(p => p.created_at >= monthAgo).reduce((s, p) => s + (p.sphere_commission_ghs ?? 0), 0)

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Marketplace</p>
        </div>
        {actionMsg && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', padding: '7px 14px', borderRadius: 20 }}>{actionMsg}</p>}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {([
          { key: 'pending', label: `Pending (${pendingCreators.length + pendingListings.length})` },
          { key: 'listings', label: 'All listings' },
          { key: 'revenue', label: 'Revenue' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            height: 36, padding: '0 18px', borderRadius: 20, border: 'none',
            background: tab === t.key ? 'var(--near-black)' : 'var(--white)',
            color: tab === t.key ? '#fff' : 'var(--mid-grey)',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p>}

      {/* PENDING TAB */}
      {!loading && tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Creator profiles */}
          {pendingCreators.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Creator profiles ({pendingCreators.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingCreators.map(creator => (
                  <CreatorApprovalCard key={creator.id} creator={creator} onApprove={() => approveCreator(creator.id)} onReject={(note) => rejectCreator(creator.id, note)} />
                ))}
              </div>
            </div>
          )}

          {/* Pending listings */}
          {pendingListings.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Marketplace listings ({pendingListings.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} onApprove={() => approveListing(listing.id)} onReject={(note) => rejectListing(listing.id, note)} onDelist={() => delistListing(listing.id)} />
                ))}
              </div>
            </div>
          )}

          {pendingCreators.length === 0 && pendingListings.length === 0 && (
            <div style={{ background: 'var(--white)', borderRadius: 12, padding: '40px', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 6 }}>No pending approvals</p>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>All creator profiles and listings are reviewed.</p>
            </div>
          )}
        </div>
      )}

      {/* ALL LISTINGS TAB */}
      {!loading && tab === 'listings' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'approved', 'pending', 'rejected', 'delisted'].map(f => (
              <button key={f} onClick={() => setListingFilter(f)} style={{
                height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
                background: listingFilter === f ? 'var(--near-black)' : 'var(--white)',
                color: listingFilter === f ? '#fff' : 'var(--mid-grey)',
                fontSize: 12, fontWeight: listingFilter === f ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
              }}>{f}</button>
            ))}
          </div>
          <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Title', 'Creator', 'Type', 'Price', 'Commission', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredListings.map((listing, i) => {
                  const statusColor: Record<string, string> = { approved: '#1A8966', pending: '#D97010', rejected: '#C23B2A', delisted: '#A09DA8' }
                  const sc = statusColor[listing.status] ?? '#A09DA8'
                  return (
                    <tr key={listing.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)', maxWidth: 200 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{listing.title}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--mid-grey)' }}>
                        {(listing as { creator_profiles?: { slug: string; users?: { name: string } } }).creator_profiles?.users?.name ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>{TYPE_LABEL[listing.resource_type] ?? listing.resource_type}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: listing.is_free ? 'var(--teal)' : 'var(--near-black)' }}>
                        {listing.is_free ? 'Free' : `GH₵${listing.price_ghs}`}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--mid-grey)' }}>{listing.commission_rate ?? 15}%</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: sc, background: `${sc}15`, padding: '3px 8px', borderRadius: 20 }}>{listing.status}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {listing.status === 'pending' && (
                            <button onClick={() => approveListing(listing.id)} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>
                          )}
                          {listing.status === 'approved' && (
                            <button onClick={() => delistListing(listing.id)} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--coral-light)', color: 'var(--coral)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delist</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredListings.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No listings.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVENUE TAB */}
      {!loading && tab === 'revenue' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Revenue this month', value: `GH₵ ${revenueThisMonth.toFixed(2)}`, accent: '#1A8966' },
              { label: 'Total all-time', value: `GH₵ ${totalRevenue.toFixed(2)}`, accent: '#1052A3' },
              { label: 'Total sales', value: purchases.length, accent: '#D97010' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-soft)', borderTop: `2px solid ${s.accent}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Recent transactions (last 200)</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Listing', 'Sale amount', 'Sphere commission', 'Date'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--near-black)' }}>
                      {(p as { marketplace_listings?: { title: string } }).marketplace_listings?.title ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>GH₵ {p.amount_ghs}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>GH₵ {p.sphere_commission_ghs}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CreatorApprovalCard({ creator, onApprove, onReject }: { creator: CreatorProfile; onApprove: () => void; onReject: (note: string) => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--shadow-soft)', borderLeft: '3px solid #D97010' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: creator.banner_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(creator.users?.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{creator.users?.name}</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{creator.users?.email}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Slug request: <span style={{ fontWeight: 600, color: 'var(--near-black)' }}>/{creator.slug}</span></p>
          {creator.tagline && <p style={{ fontSize: 13, color: 'var(--mid-grey)', fontStyle: 'italic' }}>&ldquo;{creator.tagline}&rdquo;</p>}
          {creator.bio && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 4, lineHeight: 1.5 }}>{creator.bio.slice(0, 160)}{creator.bio.length > 160 ? '...' : ''}</p>}
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>Requested {new Date(creator.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>
        {!rejecting && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setRejecting(true)} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--mid-grey)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
            <button onClick={onApprove} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>
          </div>
        )}
      </div>
      {rejecting && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <input
            placeholder="Rejection reason (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ width: '100%', height: 36, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRejecting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--mid-grey)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => onReject(note)} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm rejection</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ListingCard({ listing, onApprove, onReject, onDelist }: { listing: Listing; onApprove: () => void; onReject: (note: string) => void; onDelist: () => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-soft)', borderLeft: '3px solid #D97010' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>{listing.title}</p>
          <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
            {TYPE_LABEL[listing.resource_type] ?? listing.resource_type}
            {' · '}
            {listing.is_free ? 'Free' : `GH₵ ${listing.price_ghs}`}
            {' · '}
            {(listing as { creator_profiles?: { slug: string } }).creator_profiles?.slug ?? 'unknown creator'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {new Date(listing.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        {!rejecting && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setRejecting(true)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--mid-grey)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
            <button onClick={onApprove} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>
          </div>
        )}
      </div>
      {rejecting && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          <input
            placeholder="Rejection reason..."
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ width: '100%', height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRejecting(false)} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--mid-grey)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => onReject(note)} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm rejection</button>
          </div>
        </div>
      )}
    </div>
  )
}
