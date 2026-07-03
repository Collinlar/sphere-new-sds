'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { fetchNoteById, updateNote } from '@/lib/content-resources'
import type { NoteBlock } from '@/lib/types'

function emptyBlock(): NoteBlock {
  return { id: crypto.randomUUID(), type: 'text', content: { text: '' } }
}

function NotesBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const noteId = searchParams.get('id')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [blocks, setBlocks] = useState<NoteBlock[]>([emptyBlock()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!noteId) {
      setLoading(false)
      return
    }
    fetchNoteById(noteId).then((note) => {
      if (!note) {
        setError('Notes pack not found.')
        setLoading(false)
        return
      }
      setTitle(note.title)
      setSubject(note.subject ?? '')
      setGradeLevel(note.grade_level ?? '')
      setBlocks(note.blocks?.length ? note.blocks : [emptyBlock()])
      setLoading(false)
    })
  }, [noteId])

  async function save(publish: boolean) {
    if (!noteId || !title.trim()) {
      setError('Give your notes a title first.')
      return
    }
    setSaving(true)
    setError('')
    const result = await updateNote(noteId, {
      title: title.trim(),
      subject: subject || undefined,
      grade_level: gradeLevel || undefined,
      blocks: blocks.filter((b) => String(b.content?.text ?? '').trim()),
      is_published: publish,
      is_downloadable: true,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/platform/library')
  }

  if (loading) {
    return <p style={{ padding: 28, color: 'var(--mid-grey)' }}>Loading notes...</p>
  }

  if (!noteId) {
    return (
      <div style={{ padding: 28 }}>
        <p style={{ color: 'var(--coral)', marginBottom: 12 }}>No notes selected.</p>
        <Link href="/platform/library" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Back to library</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Notes builder"
        left={
          <Link href="/platform/library" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Library
          </Link>
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => save(false)} disabled={saving} style={btnSecondary}>{saving ? 'Saving...' : 'Save draft'}</button>
            <button onClick={() => save(true)} disabled={saving} style={{ ...btnPrimary, background: '#2E2886' }}>Publish notes</button>
          </div>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 760 }}>
        {error && <p style={{ color: 'var(--coral)', marginBottom: 12, fontSize: 13 }}>{error}</p>}

        <div className="sphere-card" style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Title</label>
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

        {blocks.map((block, index) => (
          <div key={block.id} className="sphere-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2E2886' }}>Block {index + 1}</span>
              {blocks.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                  style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              value={String(block.content?.text ?? '')}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((b) => (b.id === block.id ? { ...b, content: { text: e.target.value } } : b))
                )
              }
              rows={5}
              placeholder="Write your notes here..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        ))}

        <button type="button" onClick={() => setBlocks((prev) => [...prev, emptyBlock()])} style={btnSecondary}>
          Add block
        </button>
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

export default function NotesBuilderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <NotesBuilderInner />
    </Suspense>
  )
}
