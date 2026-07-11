'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getActiveContext } from '@/lib/context'
import { isInstitutionVerified } from '@/lib/institution-verification'

interface TemplateRow {
  id: string
  name: string
  file_url: string | null
  template_type: string
  is_active: boolean
}

const MAX_MB = 5

export default function CertificateSettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [ownerId, setOwnerId] = useState('')
  const [ownerType, setOwnerType] = useState<'institution' | 'creator'>('creator')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    const ctx = getActiveContext()
    const user = getCurrentUser()
    // Institution context: the institution owns the templates. Personal: the creator.
    const oid = ctx.type === 'institution' ? ctx.institutionId : user.id
    setOwnerId(oid)
    setOwnerType(ctx.type === 'institution' ? 'institution' : 'creator')

    // Custom branded certificates are for VERIFIED institutions only.
    if (ctx.type === 'institution') {
      isInstitutionVerified(ctx.institutionId).then(setVerified)
    }

    supabase
      .from('certificate_templates')
      .select('id, name, file_url, template_type, is_active')
      .eq('owner_id', oid)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data ?? []) as TemplateRow[])
        setLoading(false)
      })
  }, [])

  async function handleUpload(file: File) {
    setError('')
    setMessage('')
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is too large. The limit is ${MAX_MB}MB.`)
      return
    }
    setUploading(true)

    const path = `${ownerId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('certificates').upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) {
      setError('The template did not upload. Check your connection and try again.')
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(path)

    // New template becomes the active one; deactivate the rest.
    await supabase.from('certificate_templates').update({ is_active: false }).eq('owner_id', ownerId)
    const { data, error: insErr } = await supabase
      .from('certificate_templates')
      .insert({
        owner_id: ownerId,
        owner_type: ownerType,
        name: file.name.replace(/\.[^.]+$/, ''),
        template_type: 'custom_upload',
        file_url: urlData.publicUrl,
        is_active: true,
      })
      .select('id, name, file_url, template_type, is_active')
      .single()

    setUploading(false)
    if (insErr || !data) {
      setError('The template uploaded but did not save. Try again.')
      return
    }
    setTemplates(prev => [data as TemplateRow, ...prev.map(t => ({ ...t, is_active: false }))])
    setMessage('Template saved and set as active.')
  }

  async function makeActive(id: string) {
    await supabase.from('certificate_templates').update({ is_active: false }).eq('owner_id', ownerId)
    await supabase.from('certificate_templates').update({ is_active: true }).eq('id', id)
    setTemplates(prev => prev.map(t => ({ ...t, is_active: t.id === id })))
  }

  async function removeTemplate(id: string) {
    await supabase.from('certificate_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Certificate templates"
        left={<Link href="/platform/settings" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>← Settings</Link>}
      />

      <div style={{ padding: '28px 32px 60px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Certificate templates</h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24, lineHeight: 1.6 }}>
          {ownerType === 'institution'
            ? 'Upload your branded certificate. The active template is used when an exam, course, or training path your institution owns issues a certificate. Without one, learners get the Sphere default.'
            : 'Certificates you issue use the Sphere-branded template. Custom branded templates are an Institution plan feature.'}
        </p>

        {ownerType !== 'institution' ? (
          <div className="sphere-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>Branded certificates are for institutions</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
              Your learners still receive verifiable Sphere certificates on every resource that awards one. To issue certificates carrying your own logo and signatories, set up an Institution plan.
            </p>
            <Link href="/platform/settings/billing/institution" style={{ display: 'inline-block', height: 42, lineHeight: '42px', padding: '0 22px', borderRadius: 9, background: 'var(--blue)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              See the Institution plan
            </Link>
          </div>
        ) : !verified ? (
          <div className="sphere-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>Verify your institution first</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 18, maxWidth: 420, margin: '0 auto 18px' }}>
              Branded certificates carry your institution&apos;s authority, so Sphere verifies institutions before enabling them. Your learners still receive verifiable Sphere-branded certificates in the meantime. Request verification from your institution settings.
            </p>
            <Link href="/platform/settings" style={{ display: 'inline-block', height: 42, lineHeight: '42px', padding: '0 22px', borderRadius: 9, background: 'var(--blue)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Go to institution settings
            </Link>
          </div>
        ) : (
        <>

        {error && <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{error}</p>}
        {message && <p style={{ fontSize: 13, color: 'var(--teal)', background: '#DDFAF0', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{message}</p>}

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
          style={{ border: '2px dashed var(--border)', borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 24 }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
            {uploading ? 'Uploading...' : 'Drop your template here or tap to browse'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>PDF or image · up to {MAX_MB}MB</p>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>No custom templates yet. Learners currently get the Sphere default certificate.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.map(t => (
              <div key={t.id} style={{ background: 'var(--white)', borderRadius: 10, boxShadow: 'var(--shadow-soft)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  {t.file_url && (
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#2E2886', textDecoration: 'none' }}>Preview</a>
                  )}
                </div>
                {t.is_active ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1A8966', background: '#DDFAF0', padding: '3px 10px', borderRadius: 20 }}>Active</span>
                ) : (
                  <button onClick={() => makeActive(t.id)} style={{ fontSize: 12, fontWeight: 600, color: '#2E2886', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Set active</button>
                )}
                <button onClick={() => removeTemplate(t.id)} style={{ fontSize: 12, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
