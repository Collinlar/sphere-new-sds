'use client'

import { useState } from 'react'
import type { Document, Guide, GuideStep, Note, NoteBlock } from '@/lib/types'

function youTubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export function GuideViewer({ guide, accent }: { guide: Guide; accent: string }) {
  const [activeStep, setActiveStep] = useState(0)
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
            key={s.id ?? `step-${index}`}
            onClick={() => setActiveStep(index)}
            style={{
              minWidth: 36, height: 36, borderRadius: 8, border: 'none',
              background: activeStep === index ? accent : 'var(--bg2)',
              color: activeStep === index ? '#fff' : 'var(--mid-grey)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
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
        <button type="button" disabled={activeStep === 0} onClick={() => setActiveStep(Math.max(0, activeStep - 1))} style={navBtnStyle}>
          Previous step
        </button>
        <button type="button" disabled={activeStep >= steps.length - 1} onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))} style={{ ...navBtnStyle, background: accent, color: '#fff', border: 'none' }}>
          Next step
        </button>
      </div>
    </div>
  )
}

export function NoteViewer({ blocks }: { blocks: NoteBlock[] }) {
  if (blocks.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This notes pack is empty.</p>
  }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: '22px 20px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blocks.map((block, i) => {
        const c = (block.content ?? {}) as { text?: string; url?: string; caption?: string; label?: string }
        const key = block.id ?? `block-${i}`

        switch (block.type) {
          case 'heading':
            return <h2 key={key} style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)', lineHeight: 1.3 }}>{c.text ?? ''}</h2>
          case 'image':
            return c.url ? (
              <figure key={key} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt={c.caption ?? 'Note image'} style={{ maxWidth: '100%', borderRadius: 10, display: 'block' }} />
                {c.caption && <figcaption style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 6, textAlign: 'center' }}>{c.caption}</figcaption>}
              </figure>
            ) : null
          case 'video_link': {
            const embed = c.url ? youTubeEmbed(c.url) : null
            return (
              <div key={key}>
                {embed ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden' }}>
                    <iframe src={embed} title={c.label ?? 'Video'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
                  </div>
                ) : (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>▶ {c.label || 'Watch video'}</a>
                )}
                {embed && c.label && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 6 }}>{c.label}</p>}
              </div>
            )
          }
          case 'link':
            return <a key={key} href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{c.label || c.url} ↗</a>
          case 'callout':
            return (
              <div key={key} style={{ background: '#FEF9F1', border: '1px solid #E8A020', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ fontSize: 14, color: '#633806', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{c.text ?? ''}</p>
              </div>
            )
          case 'text':
          default:
            return <p key={key} style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{c.text ?? ''}</p>
        }
      })}
    </div>
  )
}

export function DocumentViewer({ document }: { document: Document }) {
  if (document.content_type === 'upload' && document.file_url) {
    const isImage = (document.mime_type ?? '').startsWith('image/')
    const isPdf = document.mime_type === 'application/pdf'
    const sizeMb = document.file_size_bytes ? (document.file_size_bytes / (1024 * 1024)).toFixed(1) : null

    return (
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={document.file_url} alt={document.title} style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 16, display: 'block' }} />
        ) : isPdf ? (
          <iframe src={document.file_url} title={document.title} style={{ width: '100%', height: 480, border: '0.5px solid var(--border)', borderRadius: 10, marginBottom: 16 }} />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.file_name ?? document.title}</p>
            {sizeMb && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>{sizeMb}MB</p>}
          </div>
          <a href={document.file_url} download={document.file_name ?? undefined} target="_blank" rel="noopener noreferrer" style={{ height: 40, padding: '0 18px', borderRadius: 8, background: document.cover_color, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Download file
          </a>
        </div>
      </div>
    )
  }

  const content = (document.content ?? {}) as {
    sections?: { heading?: string; body?: string }[]
    blocks?: { text?: string }[]
    body?: string
  }

  if (content.sections?.length) {
    return (
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {content.sections.map((s, i) => (
          <div key={i}>
            {s.heading && <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>{s.heading}</h2>}
            {s.body && <p style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</p>}
          </div>
        ))}
      </div>
    )
  }

  const paragraphs = content.blocks?.length
    ? content.blocks.map((b) => b.text ?? '').filter(Boolean)
    : String(content.body ?? '').split(/\n\s*\n/).filter(Boolean)

  if (paragraphs.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>This document has no content yet.</p>
  }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-soft)' }}>
      {paragraphs.map((para, index) => (
        <p key={index} style={{ fontSize: 15, color: 'var(--near-black)', lineHeight: 1.75, marginBottom: index < paragraphs.length - 1 ? 16 : 0, whiteSpace: 'pre-line' }}>{para}</p>
      ))}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 10,
  border: '0.5px solid var(--border)', background: 'var(--white)',
  color: 'var(--near-black)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
