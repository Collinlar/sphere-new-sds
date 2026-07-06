'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  fetchPublishedDocumentForStudent,
  fetchPublishedGuideForStudent,
  fetchPublishedNoteForStudent,
} from '@/lib/student-resources'
import { GuideViewer, NoteViewer, DocumentViewer } from '@/components/brand/ResourceViewers'
import type { Document, Guide, Note } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  guide: 'Guide',
  notes: 'Notes',
  document: 'Document',
}

export default function StudentResourceViewerPage({
  params: paramsPromise,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const params = use(paramsPromise)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [document, setDocument] = useState<Document | null>(null)

  useEffect(() => {
    async function load() {
      if (params.type === 'guide') {
        const data = await fetchPublishedGuideForStudent(params.id)
        if (!data) setNotFound(true)
        else setGuide(data)
      } else if (params.type === 'notes') {
        const data = await fetchPublishedNoteForStudent(params.id)
        if (!data) setNotFound(true)
        else setNote(data)
      } else if (params.type === 'document') {
        const data = await fetchPublishedDocumentForStudent(params.id)
        if (!data) setNotFound(true)
        else setDocument(data)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [params.type, params.id])

  const title = guide?.title ?? note?.title ?? document?.title ?? ''
  const accent = guide?.cover_color ?? note?.cover_color ?? document?.cover_color ?? '#1A8966'

  if (loading) {
    return <p style={{ padding: 24, fontSize: 14, color: 'var(--mid-grey)' }}>Opening material...</p>
  }

  if (notFound) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Material not found</p>
        <Link href="/student/resources" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
          Back to reading materials
        </Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px 40px' }}>
      <Link href="/student/resources" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
        ← Reading materials
      </Link>

      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, marginBottom: 6 }}>
          {TYPE_LABEL[params.type] ?? 'Resource'}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1.25 }}>{title}</h1>
        {guide?.description && (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginTop: 8, lineHeight: 1.6 }}>{guide.description}</p>
        )}
      </div>

      {guide && <GuideViewer guide={guide} accent={accent} />}
      {note && <NoteViewer blocks={note.blocks ?? []} />}
      {document && <DocumentViewer document={document} />}
    </div>
  )
}
