'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  fetchPublishedDocumentForStudent,
  fetchPublishedGuideForStudent,
  fetchPublishedNoteForStudent,
} from '@/lib/student-resources'
import type { Document, Guide, GuideStep, Note, NoteBlock } from '@/lib/types'

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
  const [activeStep, setActiveStep] = useState(0)

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

      {guide && <GuideViewer guide={guide} activeStep={activeStep} setActiveStep={setActiveStep} accent={accent} />}
      {note && <NoteViewer blocks={note.blocks ?? []} />}
      {document && <DocumentViewer document={document} />}
    </div>
  )
}

function GuideViewer({
  guide,
  activeStep,
  setActiveStep,
  accent,
}: {
  guide: Guide
  activeStep: number
  setActiveStep: (n: number) => void
  accent: string
}) {
  const steps = guide.steps ?? []
  const step = steps[activeStep]

  if (steps.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This guide has no steps yet.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {steps.map((s: GuideStep, index: number) => (
          <button
            key={s.id}
            onClick={() => setActiveStep(index)}
            style={{
              minWidth: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: activeStep === index ? accent : 'var(--bg2)',
              color: activeStep === index ? '#fff' : 'var(--mid-grey)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {step && (
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent, marginBottom: 8 }}>
            Step {activeStep + 1} of {steps.length}
          </p>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)', marginBottom: 12 }}>{step.title}</h2>
          <p style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{step.body}</p>
          {step.tip && (
            <div style={{ marginTop: 16, background: 'var(--amber-light)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9A5800', marginBottom: 4 }}>Tip</p>
              <p style={{ fontSize: 13, color: '#633806', lineHeight: 1.55 }}>{step.tip}</p>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
        <button
          type="button"
          disabled={activeStep === 0}
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          style={navBtnStyle}
        >
          Previous step
        </button>
        <button
          type="button"
          disabled={activeStep >= steps.length - 1}
          onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
          style={{ ...navBtnStyle, background: accent, color: '#fff', border: 'none' }}
        >
          Next step
        </button>
      </div>
    </div>
  )
}

function NoteViewer({ blocks }: { blocks: NoteBlock[] }) {
  if (blocks.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This notes pack is empty.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((block) => (
        <div key={block.id} style={{ background: 'var(--white)', borderRadius: 12, padding: 18, boxShadow: 'var(--shadow-soft)' }}>
          {block.type === 'callout' ? (
            <div style={{ background: 'var(--teal-light)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 14, color: 'var(--teal-dark)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                {String(block.content?.text ?? '')}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {String(block.content?.text ?? '')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function DocumentViewer({ document }: { document: Document }) {
  const blocks = (document.content?.blocks as { text?: string }[] | undefined) ?? []
  const body = String(document.content?.body ?? '')
  const paragraphs = blocks.length
    ? blocks.map((b) => b.text ?? '').filter(Boolean)
    : body.split(/\n\s*\n/).filter(Boolean)

  if (paragraphs.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This document has no content yet.</p>
  }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
      {paragraphs.map((para, index) => (
        <p key={index} style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.75, marginBottom: index < paragraphs.length - 1 ? 16 : 0, whiteSpace: 'pre-line' }}>
          {para}
        </p>
      ))}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  borderRadius: 10,
  border: '0.5px solid var(--border)',
  background: 'var(--white)',
  color: 'var(--near-black)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
