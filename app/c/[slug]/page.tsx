'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TYPE_COLOR: Record<string, string> = {
  course: '#1A8966',
  exam: '#C23B2A',
  quiz: '#D97010',
  guide: '#1052A3',
  notes: '#2E2886',
  document: '#D97010',
  training_path: '#1052A3',
}

const TYPE_LABEL: Record<string, string> = {
  course: 'Course',
  exam: 'Exam',
  quiz: 'Engage game',
  guide: 'Guide',
  notes: 'Notes',
  document: 'Document',
  training_path: 'Training path',
}

interface Listing {
  id: string
  title: string
  description?: string
  resource_type: string
  price_ghs: number
  is_free: boolean
  is_entry_resource: boolean
  thumbnail_color: string
  subject?: string
  total_purchases: number
  slug?: string
}

interface CreatorData {
  slug: string
  bio?: string
  tagline?: string
  banner_color: string
  total_sales: number
  total_revenue_ghs: number
  users: {
    name: string
    avatar_initials: string
  }
}

export default function CreatorStorefront() {
  const { slug } = useParams<{ slug: string }>()
  const [creator, setCreator] = useState<CreatorData | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: profileData } = await supabase
        .from('creator_profiles')
        .select('*, users(name, avatar_initials)')
        .eq('slug', slug)
        .eq('is_approved', true)
        .single()

      if (!profileData) { setLoading(false); return }
      setCreator(profileData as CreatorData)

      const { data: listingsData } = await supabase
        .from('marketplace_listings')
        .select('id, title, description, resource_type, price_ghs, is_free, is_entry_resource, thumbnail_color, subject, total_purchases, slug')
        .eq('creator_id', (profileData as { user_id: string }).user_id)
        .eq('status', 'approved')
        .order('is_entry_resource', { ascending: false })
        .order('total_purchases', { ascending: false })

      setListings((listingsData ?? []) as Listing[])
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading creator profile...</p>
      </div>
    )
  }

  if (!creator) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--near-black)' }}>This creator profile does not exist.</p>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Check the link and try again.</p>
        <Link href="/platform/marketplace" style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
          Browse the marketplace
        </Link>
      </div>
    )
  }

  const resourceTypes = ['all', ...Array.from(new Set(listings.map(l => l.resource_type)))]
  const filtered = activeFilter === 'all' ? listings : listings.filter(l => l.resource_type === activeFilter)
  const freeEntry = listings.find(l => l.is_entry_resource)
  const paid = listings.filter(l => !l.is_entry_resource)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: 'var(--font)' }}>
      {/* Banner */}
      <div style={{
        background: creator.banner_color,
        padding: '40px 28px 0',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {/* SphereSDS nav link */}
          <div style={{ marginBottom: 28 }}>
            <Link href="/platform/marketplace" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 500 }}>
              SphereSDS Marketplace
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, paddingBottom: 0 }}>
            {/* Avatar */}
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: '3px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              marginBottom: -20,
              position: 'relative',
              zIndex: 2,
            }}>
              {creator.users?.avatar_initials ?? '??'}
            </div>

            <div style={{ paddingBottom: 24, flex: 1 }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {creator.users?.name}
              </p>
              {creator.tagline && (
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{creator.tagline}</p>
              )}
            </div>

            <div style={{ paddingBottom: 24, textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{listings.length}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Resources</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px 48px' }}>
        {/* Bio */}
        {creator.bio && (
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--shadow-soft)', marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.7 }}>{creator.bio}</p>
          </div>
        )}

        {/* Free entry resource */}
        {freeEntry && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 12 }}>
              Free resource
            </p>
            <Link
              href={`/platform/marketplace/${freeEntry.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: 'var(--white)',
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-soft)',
                borderLeft: '3px solid var(--teal)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: freeEntry.thumbnail_color,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.8)',
                  textTransform: 'uppercase',
                }}>
                  {TYPE_LABEL[freeEntry.resource_type]?.slice(0, 3) ?? 'RES'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 3 }}>{freeEntry.title}</p>
                  {freeEntry.description && (
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>{freeEntry.description.slice(0, 100)}{freeEntry.description.length > 100 ? '...' : ''}</p>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', background: 'var(--teal-light)', padding: '4px 12px', borderRadius: 20, flexShrink: 0 }}>
                  Free
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Filter chips */}
        {resourceTypes.length > 2 && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
            {resourceTypes.map(type => {
              const active = activeFilter === type
              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 20,
                    border: 'none',
                    background: active ? 'var(--near-black)' : 'var(--white)',
                    color: active ? '#fff' : 'var(--mid-grey)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  {type === 'all' ? 'All resources' : (TYPE_LABEL[type] ?? type)}
                </button>
              )
            })}
          </div>
        )}

        {/* Resource grid */}
        {paid.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              {activeFilter === 'all' ? 'All resources' : (TYPE_LABEL[activeFilter] ?? activeFilter)} ({filtered.filter(l => !l.is_entry_resource).length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {filtered.filter(l => !l.is_entry_resource).map(listing => {
                const color = TYPE_COLOR[listing.resource_type] ?? 'var(--teal)'
                const typeLabel = TYPE_LABEL[listing.resource_type] ?? listing.resource_type
                return (
                  <Link key={listing.id} href={`/platform/marketplace/${listing.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--white)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-soft)',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-soft)' }}
                    >
                      {/* Thumbnail */}
                      <div style={{ height: 72, background: listing.thumbnail_color, position: 'relative' }}>
                        <span style={{
                          position: 'absolute',
                          top: 8,
                          left: 10,
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'rgba(255,255,255,0.75)',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '2px 7px',
                          borderRadius: 20,
                        }}>
                          {typeLabel}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px 14px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4, lineHeight: 1.35 }}>
                          {listing.title}
                        </p>
                        {listing.subject && (
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{listing.subject}</p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: listing.is_free ? 'var(--teal)' : 'var(--amber)',
                          }}>
                            {listing.is_free ? 'Free' : `GH₵ ${listing.price_ghs}`}
                          </span>
                          {listing.total_purchases > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {listing.total_purchases} {listing.total_purchases === 1 ? 'buyer' : 'buyers'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {listings.length === 0 && (
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '32px 24px', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>No resources published yet.</p>
          </div>
        )}

        {/* Powered by */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Powered by{' '}
            <Link href="/" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
              SphereSDS
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
