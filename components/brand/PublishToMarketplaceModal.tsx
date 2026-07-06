'use client'

import { useEffect, useState } from 'react'
import {
  publishExistingResource,
  unpublishListing,
  getListingForResource,
  TARGET_LEVEL_TYPES,
  type PublishableResourceType,
} from '@/lib/marketplace-publish'

interface PublishToMarketplaceModalProps {
  open: boolean
  onClose: () => void
  onPublished?: () => void
  resourceType: PublishableResourceType
  resourceId: string
  defaultTitle: string
  defaultDescription?: string | null
  defaultSubject?: string | null
  defaultColor?: string | null
}

export default function PublishToMarketplaceModal({
  open, onClose, onPublished,
  resourceType, resourceId, defaultTitle, defaultDescription, defaultSubject, defaultColor,
}: PublishToMarketplaceModalProps) {
  const [checking, setChecking] = useState(true)
  const [existingListing, setExistingListing] = useState<{ id: string; status: string } | null>(null)
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState(defaultDescription ?? '')
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [pricing, setPricing] = useState<'free' | 'paid'>('free')
  const [priceGhs, setPriceGhs] = useState('')
  const [isEntryResource, setIsEntryResource] = useState(false)
  const [levelTypes, setLevelTypes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setChecking(true)
    getListingForResource(resourceId).then(listing => {
      setExistingListing(listing)
      setChecking(false)
    })
  }, [open, resourceId])

  if (!open) return null

  function toggleLevel(id: string) {
    setLevelTypes(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])
  }

  async function handlePublish() {
    if (!title.trim()) { setError('Give this listing a title.'); return }
    if (levelTypes.length === 0) { setError('Pick at least one level this resource suits.'); return }
    if (pricing === 'paid' && (!priceGhs || parseFloat(priceGhs) <= 0)) { setError('Set a price in GH₵, or switch to free.'); return }

    setSaving(true)
    setError('')

    const result = await publishExistingResource({
      resourceType,
      resourceId,
      title,
      description,
      subject,
      thumbnailColor: defaultColor,
      priceGhs: pricing === 'free' ? 0 : parseFloat(priceGhs),
      isEntryResource,
      targetLevelTypes: levelTypes,
    })

    setSaving(false)

    if (!result.ok) { setError(result.error); return }

    onPublished?.()
    onClose()
  }

  async function handleUnpublish() {
    if (!existingListing) return
    setSaving(true)
    await unpublishListing(existingListing.id, resourceId, resourceType)
    setSaving(false)
    onPublished?.()
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg2)',
    fontSize: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,16,33,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(12,16,33,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '0.5px solid var(--bg2)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
            {existingListing ? 'Marketplace listing' : 'Publish to marketplace'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
            {existingListing
              ? 'This resource is listed on the marketplace.'
              : 'List this exactly as it is — no need to rebuild it.'}
          </p>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {checking ? (
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Checking listing status...</p>
          ) : existingListing ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                padding: '10px 12px', borderRadius: 8,
                background: existingListing.status === 'approved' ? '#DDFAF0' : existingListing.status === 'rejected' ? '#FDECEA' : '#FEF0DC',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: existingListing.status === 'approved' ? '#1A8966' : existingListing.status === 'rejected' ? '#C23B2A' : '#9A5800',
                }}>
                  {existingListing.status === 'approved' ? 'Live on marketplace' : existingListing.status === 'rejected' ? 'Not approved' : 'Awaiting review'}
                </span>
              </div>
              <button
                onClick={handleUnpublish}
                disabled={saving}
                style={{
                  width: '100%', height: 42, borderRadius: 8, border: '1px solid #C23B2A',
                  background: 'var(--white)', color: '#C23B2A', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Removing...' : 'Remove from marketplace'}
              </button>
            </div>
          ) : (
            <>
              {error && (
                <p style={{ fontSize: 13, color: '#C23B2A', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{error}</p>
              )}

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>Listing title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="What will buyers get from this?"
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Biology, ICT" style={{ ...inputStyle, marginBottom: 16 }} />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>Who is this for?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {TARGET_LEVEL_TYPES.map(t => {
                  const active = levelTypes.includes(t.id)
                  return (
                    <button key={t.id} onClick={() => toggleLevel(t.id)} style={{
                      height: 30, padding: '0 12px', borderRadius: 20, border: 'none',
                      background: active ? 'var(--near-black)' : 'var(--bg2)',
                      color: active ? '#fff' : 'var(--mid-grey)',
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                <input type="checkbox" checked={isEntryResource} onChange={e => setIsEntryResource(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 13, color: 'var(--near-black)' }}>Make this my free showcase resource</span>
              </label>

              {!isEntryResource && (
                <>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 8 }}>Pricing</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {(['free', 'paid'] as const).map(p => (
                      <button key={p} onClick={() => setPricing(p)} style={{
                        flex: 1, height: 40, borderRadius: 8,
                        border: pricing === p ? '1.5px solid #1A8966' : '1px solid var(--border)',
                        background: pricing === p ? '#DDFAF0' : 'var(--white)',
                        color: pricing === p ? '#1A8966' : 'var(--mid-grey)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                      }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {pricing === 'paid' && (
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 6 }}>Price (GH₵)</label>
                      <input value={priceGhs} onChange={e => setPriceGhs(e.target.value)} type="number" min={1} placeholder="e.g. 25" style={inputStyle} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {!checking && !existingListing && (
          <div style={{ padding: '14px 22px 20px', borderTop: '0.5px solid var(--bg2)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 14px' }}>
              Cancel
            </button>
            <button onClick={handlePublish} disabled={saving} style={{
              background: '#1A8966', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
