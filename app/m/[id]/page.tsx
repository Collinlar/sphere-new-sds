'use client'

import { useEffect, useState, use, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { loadMemberships } from '@/lib/context'
import { destinationInstitutionId, destinationKey } from '@/lib/library-scope'
import { importResource, formatPrice, hasImported } from '@/lib/marketplace'
import { startCheckout, verifyCheckoutReference } from '@/lib/checkout-client'
import ImportDestinationPicker, { useImportDestination } from '@/components/brand/ImportDestinationPicker'

const TYPE_LABEL: Record<string, string> = {
  course: 'Course', exam: 'Exam', quiz: 'Engage game',
  guide: 'Guide', notes: 'Notes', document: 'Document', training_path: 'Training path',
}

interface PublicListing {
  id: string
  title: string
  description: string | null
  resource_type: string
  price_ghs: number
  is_free: boolean
  subject: string | null
  thumbnail_color: string
  total_purchases: number
  creator_id: string | null
  creator_name?: string
  creator_slug?: string
}

export default function PublicListingPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <PublicListingInner paramsPromise={paramsPromise} />
    </Suspense>
  )
}

function PublicListingInner({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [listing, setListing] = useState<PublicListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [imported, setImported] = useState(false)
  const [staffPreview, setStaffPreview] = useState(false)
  const [outline, setOutline] = useState<{
    summary: string
    stats: { label: string; value: string }[]
    items: { title: string; meta?: string }[]
    staffNotes?: string[]
  } | null>(null)
  const [importDestination, setImportDestination] = useImportDestination()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const isSignedIn = !!data.session
      setSignedIn(isSignedIn)
      if (isSignedIn && data.session?.user.id) {
        await loadMemberships(data.session.user.id)
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadOutline() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch(`/api/marketplace/listing-preview?id=${encodeURIComponent(params.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok || cancelled) return
      const body = await res.json()
      if (!cancelled && body.outline) setOutline(body.outline)
    }
    loadOutline()
    return () => { cancelled = true }
  }, [params.id])

  useEffect(() => {
    const reference = searchParams.get('reference')
    if (!reference) return
    verifyCheckoutReference(reference).then((result) => {
      if (result.ok) {
        setMessage('Purchase confirmed. This resource is now in your library.')
        window.history.replaceState({}, '', `/m/${params.id}`)
      } else {
        setError(result.error)
      }
    })
  }, [searchParams, params.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      // creator_id references users, not creator_profiles — embedding
      // creator_profiles here fails the whole query and looks like a missing listing.
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, title, description, resource_type, price_ghs, is_free, subject, thumbnail_color, total_purchases, creator_id, status, users!marketplace_listings_creator_id_fkey(name)')
        .eq('id', params.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setLoading(false)
        return
      }

      const status = (data as { status?: string }).status
      // Approved listings are public. Anything else is only visible to Sphere
      // staff, so they can preview a pending listing before approving it.
      if (status !== 'approved') {
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        const staff = uid
          ? (await supabase.from('users').select('is_sphere_staff').eq('id', uid).maybeSingle()).data?.is_sphere_staff
          : false
        if (!staff) {
          setLoading(false)
          return
        }
        if (!cancelled) setStaffPreview(true)
      }

      const creatorName = (data as unknown as { users?: { name: string } | null }).users?.name
      let creatorSlug: string | undefined
      if (data.creator_id) {
        const { data: profile } = await supabase
          .from('creator_profiles')
          .select('slug')
          .eq('user_id', data.creator_id)
          .maybeSingle()
        creatorSlug = profile?.slug ?? undefined
      }

      setListing({
        id: data.id,
        title: data.title,
        description: data.description,
        resource_type: data.resource_type,
        price_ghs: Number(data.price_ghs ?? 0),
        is_free: Boolean(data.is_free),
        subject: data.subject,
        thumbnail_color: data.thumbnail_color ?? '#1A8966',
        total_purchases: Number(data.total_purchases ?? 0),
        creator_id: data.creator_id,
        creator_name: creatorName,
        creator_slug: creatorSlug,
      })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [params.id])

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    async function checkImported() {
      const user = getCurrentUser()
      const done = await hasImported(params.id, importDestination, user.id)
      if (!cancelled) setImported(done)
    }
    checkImported()
    return () => { cancelled = true }
  }, [params.id, signedIn, destinationKey(importDestination)])

  async function handleGet() {
    if (!listing) return
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(`/m/${listing.id}`)}`)
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    const user = getCurrentUser()

    if (listing.is_free) {
      const result = await importResource(listing.id, user.id, importDestination)
      setBusy(false)
      if (!result.ok) { setError(result.error); return }
      setImported(true)
      setMessage('Added to your library. Open Sphere to use it.')
      return
    }

    const institutionId = destinationInstitutionId(importDestination)
    const result = await startCheckout({
      intentType: 'marketplace',
      payload: {
        listingId: listing.id,
        institutionId: institutionId ?? undefined,
        importDestinationKind: importDestination.kind,
      },
      callbackPath: `/m/${listing.id}`,
    })
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading resource...</p>
    </div>
  }

  if (!listing) {
    return <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>This resource is not available.</p>
      <p style={{ fontSize: 13, color: 'var(--mid-grey)', maxWidth: 360, lineHeight: 1.5 }}>
        It may still be under review, or the link may be wrong. Sign in as Sphere staff to preview pending listings.
      </p>
      <Link href="/" style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Go to SphereSDS</Link>
    </div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: 'var(--font)' }}>
      {staffPreview && (
        <div style={{ background: '#2E2886', color: '#fff', padding: '9px 20px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
          Staff preview — this listing is not yet approved. This is what a buyer would see.
        </div>
      )}
      {/* Public header */}
      <div style={{ background: 'var(--white)', borderBottom: '0.5px solid var(--border)', padding: '14px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontSize: 15, fontWeight: 800, color: 'var(--near-black)', textDecoration: 'none', letterSpacing: '-0.02em' }}>
            Sphere<span style={{ color: 'var(--amber)' }}>SDS</span>
          </Link>
          {!signedIn && (
            <Link href="/login" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>Sign in</Link>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: listing.thumbnail_color, padding: '32px 24px 26px' }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
            {listing.subject && (
              <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: '#fff' }}>{listing.subject}</span>
            )}
            <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              {TYPE_LABEL[listing.resource_type] ?? listing.resource_type}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 10, lineHeight: 1.25 }}>{listing.title}</h1>
          {listing.creator_name && (
            <Link href={listing.creator_slug ? `/c/${listing.creator_slug}` : '#'} style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>
              By {listing.creator_name}
            </Link>
          )}
        </div>

        <div style={{ padding: '22px 22px 40px' }}>
          {listing.description && (
            <div style={{ background: 'var(--white)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--near-black)', lineHeight: 1.7 }}>{listing.description}</p>
            </div>
          )}

          {outline && (
            <div style={{ background: 'var(--white)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mid-grey)', marginBottom: 8 }}>
                What&apos;s inside
              </p>
              <p style={{ fontSize: 14, color: 'var(--near-black)', lineHeight: 1.6, marginBottom: outline.stats.length ? 14 : 0 }}>
                {outline.summary}
              </p>
              {outline.stats.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: outline.items.length ? 14 : 0 }}>
                  {outline.stats.map((stat) => (
                    <div key={stat.label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', minWidth: 72 }}>
                      <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginBottom: 2 }}>{stat.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {outline.items.length > 0 && (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {outline.items.map((item, i) => (
                    <li key={`${item.title}-${i}`} style={{ fontSize: 13, color: 'var(--near-black)', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      {item.meta && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--mid-grey)', fontWeight: 400, marginTop: 2 }}>
                          {item.meta}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {staffPreview && outline.staffNotes?.map((note) => (
                <p key={note} style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 12, lineHeight: 1.5 }}>{note}</p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: listing.is_free ? 'var(--teal)' : 'var(--amber)' }}>
              {formatPrice(listing.is_free ? 0 : listing.price_ghs)}
            </span>
            {listing.total_purchases > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {listing.total_purchases} {listing.total_purchases === 1 ? 'buyer' : 'buyers'}
              </span>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{error}</p>}
          {message && <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 12 }}>{message}</p>}

          {signedIn && !imported && (
            <ImportDestinationPicker
              value={importDestination}
              onChange={setImportDestination}
              compact
            />
          )}

          <button
            onClick={handleGet}
            disabled={busy || imported}
            style={{
              width: '100%', height: 50, borderRadius: 12, border: 'none',
              background: imported ? 'var(--bg2)' : listing.is_free ? 'var(--teal)' : 'var(--amber)',
              color: imported ? 'var(--mid-grey)' : '#fff', fontSize: 15, fontWeight: 700,
              cursor: busy || imported ? 'default' : 'pointer', fontFamily: 'var(--font)',
            }}
          >
            {imported
              ? 'Already in your library'
              : busy
              ? 'Working...'
              : !signedIn
                ? (listing.is_free ? 'Sign up to get it free' : `Sign up to buy — ${formatPrice(listing.price_ghs)}`)
                : (listing.is_free ? 'Add to my library — Free' : `Buy with MoMo — ${formatPrice(listing.price_ghs)}`)}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 10 }}>
            {listing.is_free ? 'A free SphereSDS account keeps it in your library.' : 'Paid via MTN MoMo or card through Paystack.'}
          </p>
        </div>
      </div>
    </div>
  )
}
