'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getContentInstitutionId } from '@/lib/context'
import { canCreate, incrementUsed } from '@/lib/subscription'

interface DocSection {
  heading: string
  body: string
}

const COVER_COLORS = ['#D97010', '#1052A3', '#1A8966', '#2E2886', '#C23B2A']
const MAX_FILE_MB = 20
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg'

export default function DocumentsBuilderPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'editor' | 'upload'>('editor')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0])
  const [sections, setSections] = useState<DocSection[]>([{ heading: '', body: '' }])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')

  function updateSection(index: number, patch: Partial<DocSection>) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function addSection() {
    setSections(prev => [...prev, { heading: '', body: '' }])
  }

  function removeSection(index: number) {
    if (sections.length === 1) return
    setSections(prev => prev.filter((_, i) => i !== index))
  }

  function handleFilePick(picked: File | null) {
    setError('')
    if (!picked) return
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is too large. The limit is ${MAX_FILE_MB}MB.`)
      return
    }
    setFile(picked)
    if (!title.trim()) {
      setTitle(picked.name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' '))
    }
  }

  async function handleSave(publish: boolean) {
    if (!title.trim()) { setError('Give your document a title first.'); return }

    if (mode === 'editor' && sections.every(s => !s.heading.trim() && !s.body.trim())) {
      setError('Add some content before saving.')
      return
    }
    if (mode === 'upload' && !file) {
      setError('Choose a file to upload first.')
      return
    }

    const gate = await canCreate('learn')
    if (!gate.allowed) { setError(gate.reason ?? 'You cannot create a document right now.'); return }

    setSaving(true)
    setError('')

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null
    let mimeType: string | null = null

    if (mode === 'upload' && file) {
      setUploadProgress('Uploading your file...')
      const path = `${getCurrentUser().id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        setError('The file did not upload. Check your connection and try again.')
        setSaving(false)
        setUploadProgress('')
        return
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      fileUrl = urlData.publicUrl
      fileName = file.name
      fileSize = file.size
      mimeType = file.type
      setUploadProgress('')
    }

    const { error: saveError } = await supabase.from('documents').insert({
      creator_id: getCurrentUser().id,
      institution_id: getContentInstitutionId(),
      title: title.trim(),
      cover_color: coverColor,
      content_type: mode,
      content: mode === 'editor' ? { sections: sections.filter(s => s.heading.trim() || s.body.trim()) } : null,
      file_url: fileUrl,
      file_name: fileName,
      file_size_bytes: fileSize,
      mime_type: mimeType,
      is_published: publish,
      subject: subject.trim() || null,
    })

    setSaving(false)

    if (saveError) {
      setError('Your document did not save. Check your connection and try again.')
      return
    }

    await incrementUsed('learn')
    router.push('/learn')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--white)',
    fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title="Document builder"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSave(false)} disabled={saving} style={{
              height: 36, padding: '0 14px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--white)',
              fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Save draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} style={{
              height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
              background: coverColor, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? (uploadProgress || 'Saving...') : 'Publish document'}
            </button>
          </div>
        }
      />

      <div className="r-pad" style={{ padding: '28px 32px 60px', maxWidth: 760 }}>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>{error}</p>
        )}

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {([
            { key: 'editor', label: 'Write it here', desc: 'Build the document with sections' },
            { key: 'upload', label: 'Upload a file', desc: 'PDF, Word, slides, or image' },
          ] as const).map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, textAlign: 'left',
              border: mode === m.key ? `1.5px solid ${coverColor}` : '1.5px solid var(--border)',
              background: mode === m.key ? 'var(--white)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: mode === m.key ? coverColor : 'var(--near-black)' }}>{m.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {COVER_COLORS.map(c => (
              <button key={c} onClick={() => setCoverColor(c)} style={{
                width: 22, height: 22, borderRadius: '50%', background: c,
                border: coverColor === c ? '2.5px solid var(--near-black)' : '2.5px solid transparent',
                cursor: 'pointer', padding: 0,
              }} aria-label={`Cover colour ${c}`} />
            ))}
          </div>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (optional)"
            style={{ ...inputStyle, width: 180, height: 34, padding: '0 10px', fontSize: 12 }} />
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled document"
          style={{
            width: '100%', fontSize: 30, fontWeight: 800, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--near-black)', fontFamily: 'var(--font)',
            padding: '8px 0 4px', boxSizing: 'border-box', letterSpacing: '-0.02em',
            borderBottom: `3px solid ${coverColor}`, marginBottom: 20,
          }}
        />

        {mode === 'editor' ? (
          <>
            {sections.map((s, i) => (
              <div key={i} className="sphere-card" style={{ marginBottom: 12, position: 'relative' }}>
                {sections.length > 1 && (
                  <button onClick={() => removeSection(i)} title="Remove section" style={{
                    position: 'absolute', top: 12, right: 14,
                    border: 'none', background: 'transparent', fontSize: 16,
                    color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  }}>×</button>
                )}
                <input
                  value={s.heading}
                  onChange={e => updateSection(i, { heading: e.target.value })}
                  placeholder={`Section ${i + 1} heading`}
                  style={{ ...inputStyle, border: 'none', padding: '0 0 8px', background: 'transparent', fontSize: 16, fontWeight: 700 }}
                />
                <textarea
                  value={s.body}
                  onChange={e => updateSection(i, { body: e.target.value })}
                  placeholder="Section content..."
                  rows={5}
                  style={{ ...inputStyle, height: 'auto', border: 'none', padding: 0, background: 'transparent', resize: 'vertical', lineHeight: 1.7 }}
                />
              </div>
            ))}
            <button onClick={addSection} style={{
              width: '100%', height: 40, borderRadius: 8,
              border: '1px dashed var(--border)', background: 'transparent',
              fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add section
            </button>
          </>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFilePick(e.dataTransfer.files[0] ?? null) }}
            style={{
              border: `2px dashed ${file ? coverColor : 'var(--border)'}`,
              borderRadius: 14, padding: '48px 24px', textAlign: 'center',
              cursor: 'pointer', background: file ? 'var(--white)' : 'transparent',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={e => handleFilePick(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            {file ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 600, color: coverColor, marginBottom: 4 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                  {(file.size / (1024 * 1024)).toFixed(1)}MB · Tap to choose a different file
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>
                  Drop your file here or tap to browse
                </p>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                  PDF, Word, PowerPoint, Excel, or images · up to {MAX_FILE_MB}MB
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
