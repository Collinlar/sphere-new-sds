'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { IconInfo } from '@/components/icons'
import { getCurrentUser } from '@/lib/auth'
import {
  publishResource,
  saveResourceDraft,
  RESOURCE_TYPES,
  SUBJECTS,
  LEVELS,
  type MarketplaceResourceType,
} from '@/lib/marketplace'

export default function PublishMarketplacePage() {
  const router = useRouter()
  const user = getCurrentUser()
  const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const [title, setTitle] = useState('')
  const [resourceType, setResourceType] = useState<MarketplaceResourceType>('lesson_plan')
  const [subject, setSubject] = useState('Biology')
  const [level, setLevel] = useState('JHS 2')
  const [pricing, setPricing] = useState<'free' | 'paid'>('free')
  const [priceGhs, setPriceGhs] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [attachmentInput, setAttachmentInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payload = () => ({
    title,
    resource_type: resourceType,
    subject,
    level,
    description,
    price_ghs: pricing === 'free' ? null : parseFloat(priceGhs) || 0,
    creator_id: user.id,
    institution_id: user.institution_id,
    metadata: {
      creator_name: user.name,
      creator_initials: initials,
      attachments,
    },
  })

  async function handleDraft() {
    if (!title.trim()) {
      setError('Give your resource a title first.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await saveResourceDraft(payload())
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/platform/marketplace')
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Give your resource a title first.')
      return
    }
    if (!description.trim()) {
      setError('Add a short description so reviewers know what you are publishing.')
      return
    }
    if (pricing === 'paid' && (!priceGhs || parseFloat(priceGhs) <= 0)) {
      setError('Set a price in GH₵ for paid resources.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await publishResource({ ...payload(), status: 'pending_review' })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/platform/marketplace/review')
  }

  function addAttachment() {
    const name = attachmentInput.trim()
    if (!name || attachments.includes(name)) return
    setAttachments((prev) => [...prev, name])
    setAttachmentInput('')
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((a) => a !== name))
  }

  const fieldStyle: React.CSSProperties = {
    background: 'var(--white)',
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: 'var(--shadow-soft)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--near-black)',
    fontFamily: 'var(--font)',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: 'var(--near-black)',
    fontFamily: 'var(--font)',
    cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Publish to marketplace"
        right={
          <div style={{ display: 'flex', gap: 7 }}>
            <button
              onClick={handleDraft}
              disabled={saving}
              style={{
                height: 34,
                background: 'var(--bg2)',
                border: 'none',
                borderRadius: 7,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--near-black)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Save draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                height: 34,
                background: 'var(--amber)',
                border: 'none',
                borderRadius: 7,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Submit for review
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 20px 32px' }}>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Resource title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cell division — complete unit plan"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select value={resourceType} onChange={(e) => setResourceType(e.target.value as MarketplaceResourceType)} style={selectStyle}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} style={selectStyle}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Pricing</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: pricing === 'paid' ? 8 : 0 }}>
                <button
                  type="button"
                  onClick={() => setPricing('free')}
                  style={{
                    flex: 1,
                    height: 30,
                    background: pricing === 'free' ? 'var(--near-black)' : 'var(--bg2)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: pricing === 'free' ? '#fff' : 'var(--mid-grey)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setPricing('paid')}
                  style={{
                    flex: 1,
                    height: 30,
                    background: pricing === 'paid' ? 'var(--near-black)' : 'var(--bg2)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: pricing === 'paid' ? '#fff' : 'var(--mid-grey)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Paid
                </button>
              </div>
              {pricing === 'paid' && (
                <input
                  value={priceGhs}
                  onChange={(e) => setPriceGhs(e.target.value)}
                  placeholder="GH₵ amount"
                  type="number"
                  min="1"
                  style={{ ...inputStyle, fontSize: 13 }}
                />
              )}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what teachers get when they import this resource."
              rows={4}
              style={{
                ...inputStyle,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.65,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={fieldStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Attachments</label>
              <button
                type="button"
                onClick={addAttachment}
                style={{
                  height: 28,
                  background: 'var(--blue-light)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--blue)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                + Add files
              </button>
            </div>
            <input
              value={attachmentInput}
              onChange={(e) => setAttachmentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAttachment())}
              placeholder="Filename or label, then tap Add files"
              style={{ ...inputStyle, fontSize: 12, marginBottom: attachments.length ? 8 : 0 }}
            />
            {attachments.map((name) => (
              <div key={name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 10px',
                background: 'var(--page-bg)',
                borderRadius: 7,
                marginTop: 6,
              }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: 'var(--teal-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--teal)',
                  flexShrink: 0,
                }}>
                  {name.split('.').pop()?.slice(0, 3).toUpperCase() ?? 'F'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--near-black)', flex: 1 }}>{name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(name)}
                  style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--amber-light)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            gap: 9,
            alignItems: 'flex-start',
          }}>
            <IconInfo size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#9A5800', lineHeight: 1.5 }}>
              Your resource will be reviewed by the SphereSDS team before going live. Usually within 48 hours.
            </p>
          </div>

          <Link href="/platform/marketplace" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none', textAlign: 'center' }}>
            Back to marketplace
          </Link>
        </div>
      </div>
    </div>
  )
}
