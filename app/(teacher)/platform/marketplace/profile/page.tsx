'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

const BANNER_COLORS = ['#1A8966', '#D97010', '#2E2886', '#1052A3', '#C23B2A', '#0C1021']

interface CreatorProfile {
  id: string
  slug: string
  bio: string | null
  tagline: string | null
  banner_color: string
  approval_status: 'pending' | 'approved' | 'rejected'
  total_sales: number
  total_revenue_ghs: number
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40)
}

export default function CreatorProfilePage() {
  const user = getCurrentUser()
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [bannerColor, setBannerColor] = useState(BANNER_COLORS[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('creator_profiles')
        .select('id, slug, bio, tagline, banner_color, approval_status, total_sales, total_revenue_ghs')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setProfile(data as CreatorProfile)
        setSlug(data.slug)
        setSlugTouched(true)
        setTagline(data.tagline ?? '')
        setBio(data.bio ?? '')
        setBannerColor(data.banner_color ?? BANNER_COLORS[0])
      } else {
        setSlug(slugify(user.name))
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    const cleanSlug = slugify(slug)
    if (cleanSlug.length < 3) {
      setError('Your profile link needs at least 3 characters.')
      return
    }
    if (!tagline.trim()) {
      setError('Add a tagline. It appears under your name across the marketplace.')
      return
    }

    setSaving(true)
    setError('')

    // Slug uniqueness check (excluding own profile)
    const { data: taken } = await supabase
      .from('creator_profiles')
      .select('id, user_id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (taken && taken.user_id !== user.id) {
      setError('That profile link is taken. Try a different one.')
      setSaving(false)
      return
    }

    if (profile) {
      const { error: updateError } = await supabase
        .from('creator_profiles')
        .update({
          slug: cleanSlug,
          tagline: tagline.trim(),
          bio: bio.trim() || null,
          banner_color: bannerColor,
        })
        .eq('id', profile.id)

      if (updateError) {
        setError('Your changes did not save. Try again.')
        setSaving(false)
        return
      }
    } else {
      const { data: created, error: insertError } = await supabase
        .from('creator_profiles')
        .insert({
          user_id: user.id,
          slug: cleanSlug,
          tagline: tagline.trim(),
          bio: bio.trim() || null,
          banner_color: bannerColor,
          approval_status: 'pending',
          is_approved: false,
        })
        .select('id, slug, bio, tagline, banner_color, approval_status, total_sales, total_revenue_ghs')
        .single()

      if (insertError || !created) {
        setError('Your profile did not save. Try again.')
        setSaving(false)
        return
      }
      setProfile(created as CreatorProfile)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const status = profile?.approval_status
  const statusBadge = status === 'approved'
    ? { label: 'Approved', color: '#1A8966', bg: '#DDFAF0' }
    : status === 'rejected'
      ? { label: 'Not approved', color: '#C23B2A', bg: '#FDECEA' }
      : status === 'pending'
        ? { label: 'Awaiting review', color: '#9A5800', bg: '#FEF0DC' }
        : null

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--white)',
    fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Creator profile"
        left={
          <Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Marketplace
          </Link>
        }
      />

      <div style={{ padding: '28px 32px 60px', maxWidth: 640 }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading your profile...</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 600 }}>Your creator storefront</h1>
              {statusBadge && (
                <span style={{ fontSize: 11, fontWeight: 600, color: statusBadge.color, background: statusBadge.bg, padding: '3px 10px', borderRadius: 20 }}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24, lineHeight: 1.6 }}>
              {profile
                ? 'This is how buyers see you across the marketplace and on your personal link.'
                : 'Set up your profile to sell on the marketplace. The Sphere team reviews new creator profiles before they go live.'}
            </p>

            {status === 'rejected' && (
              <div style={{ background: '#FDECEA', border: '1px solid #C23B2A', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#C23B2A' }}>
                  Your profile was not approved. Update it and save again to resubmit for review.
                </p>
              </div>
            )}

            {/* Banner preview */}
            <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-soft)', marginBottom: 20 }}>
              <div style={{ height: 72, background: bannerColor }} />
              <div style={{ background: 'var(--white)', padding: '0 20px 18px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: bannerColor,
                  border: '3px solid var(--white)', marginTop: -28, marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700,
                }}>
                  {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--near-black)' }}>{user.name}</p>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>{tagline || 'Your tagline appears here'}</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  spheresds.com/c/{slugify(slug) || 'your-link'}
                </p>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>{error}</p>
            )}

            <div className="sphere-card">
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                Your profile link
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>spheresds.com/c/</span>
                <input
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugTouched(true); setError('') }}
                  placeholder="your-name"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                Tagline
              </label>
              <input
                value={tagline}
                onChange={e => { setTagline(e.target.value); if (!slugTouched) setSlug(slugify(user.name)) }}
                placeholder="e.g. BECE Maths made simple"
                maxLength={80}
                style={{ ...inputStyle, marginBottom: 16 }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                About you
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell buyers who you are, what you teach, and why your resources work."
                rows={4}
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', marginBottom: 16, lineHeight: 1.6 }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 8 }}>
                Banner colour
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {BANNER_COLORS.map(c => (
                  <button key={c} onClick={() => setBannerColor(c)} style={{
                    width: 30, height: 30, borderRadius: '50%', background: c,
                    border: bannerColor === c ? '3px solid var(--near-black)' : '3px solid transparent',
                    cursor: 'pointer', padding: 0,
                  }} aria-label={`Banner colour ${c}`} />
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  height: 44, padding: '0 22px', borderRadius: 8, border: 'none',
                  background: saved ? '#1A8966' : 'var(--near-black)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving...' : saved ? 'Saved' : profile ? 'Save changes' : 'Submit for review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
