'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { fetchDocumentById, updateDocument } from '@/lib/content-resources'

function DocumentsBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const documentId = searchParams.get('id')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!documentId) {
      setLoading(false)
      return
    }
    fetchDocumentById(documentId).then((doc) => {
      if (!doc) {
        setError('Document not found.')
        setLoading(false)
        return
      }
      setTitle(doc.title)
      setSubject(doc.subject ?? '')
      setGradeLevel(doc.grade_level ?? '')
      const blocks = (doc.content?.blocks as { text?: string }[] | undefined) ?? []
      setBody(blocks.map((b) => b.text ?? '').join('\n\n') || String(doc.content?.body ?? ''))
      setLoading(false)
    })
  }, [documentId])

  async function save(publish: boolean) {
    if (!documentId || !title.trim()) {
      setError('Give your document a title first.')
      return
    }
    setSaving(true)
    setError('')
    const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim())
    const result = await updateDocument(documentId, {
      title: title.trim(),
      subject: subject || undefined,
      grade_level: gradeLevel || undefined,
      content: {
        body,
        blocks: paragraphs.map((text, index) => ({ id: `b-${index + 1}`, text: text.trim() })),
      },
      is_published: publish,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/platform/library')
  }

  if (loading) {
    return <p style={{ padding: 28, color: 'var(--mid-grey)' }}>Loading document...</p>
  }

  if (!documentId) {
    return (
      <div style={{ padding: 28 }}>
        <p style={{ color: 'var(--coral)', marginBottom: 12 }}>No document selected.</p>
        <Link href="/platform/library" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Back to library</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Document builder"
        left={
          <Link href="/platform/library" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Library
          </Link>
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => save(false)} disabled={saving} style={btnSecondary}>{saving ? 'Saving...' : 'Save draft'}</button>
            <button onClick={() => save(true)} disabled={saving} style={{ ...btnPrimary, background: '#D97010' }}>Publish document</button>
          </div>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 760 }}>
        {error && <p style={{ color: 'var(--coral)', marginBottom: 12, fontSize: 13 }}>{error}</p>}

        <div className="sphere-card" style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Document title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Level</label>
              <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        <div className="sphere-card">
          <label style={labelStyle}>Content</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            placeholder="Write your syllabus, policy, or handout here. Separate sections with a blank line."
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
          />
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--mid-grey)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg2)',
  borderRadius: 8,
  padding: '0 14px',
  border: '1px solid transparent',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: '0.5px solid var(--border)',
  background: 'var(--white)',
  color: 'var(--near-black)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function DocumentsBuilderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <DocumentsBuilderInner />
    </Suspense>
  )
}
