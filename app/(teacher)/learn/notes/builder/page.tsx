'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getContentInstitutionId } from '@/lib/context'
import { canCreate, incrementUsed } from '@/lib/subscription'

type BlockType = 'text' | 'heading' | 'image' | 'video_link' | 'link' | 'callout'

interface NoteBlock {
  type: BlockType
  content: {
    text?: string
    url?: string
    caption?: string
    label?: string
  }
}

const COVER_COLORS = ['#2E2886', '#1A8966', '#D97010', '#1052A3', '#C23B2A']

const BLOCK_MENU: { type: BlockType; label: string; hint: string }[] = [
  { type: 'heading', label: 'Heading', hint: 'Section title' },
  { type: 'text', label: 'Text', hint: 'Paragraph of writing' },
  { type: 'image', label: 'Image', hint: 'Picture from a URL' },
  { type: 'video_link', label: 'Video link', hint: 'YouTube or any video URL' },
  { type: 'link', label: 'Link', hint: 'Pointer to an external resource' },
  { type: 'callout', label: 'Callout', hint: 'Highlighted note or warning' },
]

export default function NotesBuilderPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0])
  const [isDownloadable, setIsDownloadable] = useState(true)
  const [blocks, setBlocks] = useState<NoteBlock[]>([{ type: 'text', content: { text: '' } }])
  const [menuOpenAt, setMenuOpenAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateBlock(index: number, content: NoteBlock['content']) {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, content: { ...b.content, ...content } } : b))
  }

  function insertBlock(afterIndex: number, type: BlockType) {
    const fresh: NoteBlock = { type, content: {} }
    setBlocks(prev => {
      const next = [...prev]
      next.splice(afterIndex + 1, 0, fresh)
      return next
    })
    setMenuOpenAt(null)
  }

  function removeBlock(index: number) {
    if (blocks.length === 1) return
    setBlocks(prev => prev.filter((_, i) => i !== index))
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= blocks.length) return
    setBlocks(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function blockHasContent(b: NoteBlock) {
    return Boolean(b.content.text?.trim() || b.content.url?.trim())
  }

  async function handleSave(publish: boolean) {
    if (!title.trim()) { setError('Give your note a title first.'); return }
    if (!blocks.some(blockHasContent)) { setError('Add some content before saving.'); return }

    const gate = await canCreate('learn')
    if (!gate.allowed) { setError(gate.reason ?? 'You cannot create a note right now.'); return }

    setSaving(true)
    setError('')

    const { error: saveError } = await supabase.from('notes').insert({
      creator_id: getCurrentUser().id,
      institution_id: getContentInstitutionId(),
      title: title.trim(),
      cover_color: coverColor,
      blocks: blocks.filter(blockHasContent),
      is_published: publish,
      is_downloadable: isDownloadable,
      subject: subject.trim() || null,
    })

    setSaving(false)

    if (saveError) {
      setError('Your note did not save. Check your connection and try again.')
      return
    }

    await incrementUsed('learn')
    router.push('/learn')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--white)',
    fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  function renderBlockEditor(block: NoteBlock, index: number) {
    switch (block.type) {
      case 'heading':
        return (
          <input
            value={block.content.text ?? ''}
            onChange={e => updateBlock(index, { text: e.target.value })}
            placeholder="Section heading"
            style={{ ...inputStyle, fontSize: 18, fontWeight: 700, border: 'none', padding: '4px 0', background: 'transparent' }}
          />
        )
      case 'text':
        return (
          <textarea
            value={block.content.text ?? ''}
            onChange={e => updateBlock(index, { text: e.target.value })}
            placeholder="Write here..."
            rows={Math.max(2, (block.content.text ?? '').split('\n').length)}
            style={{ ...inputStyle, border: 'none', padding: '4px 0', background: 'transparent', resize: 'none', lineHeight: 1.7 }}
          />
        )
      case 'image':
        return (
          <div>
            <input
              value={block.content.url ?? ''}
              onChange={e => updateBlock(index, { url: e.target.value })}
              placeholder="Paste an image URL"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {block.content.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.content.url} alt={block.content.caption ?? 'Note image'}
                style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
            <input
              value={block.content.caption ?? ''}
              onChange={e => updateBlock(index, { caption: e.target.value })}
              placeholder="Caption (optional)"
              style={{ ...inputStyle, fontSize: 12 }}
            />
          </div>
        )
      case 'video_link':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={block.content.url ?? ''}
              onChange={e => updateBlock(index, { url: e.target.value })}
              placeholder="Paste a YouTube or video URL"
              style={inputStyle}
            />
            <input
              value={block.content.label ?? ''}
              onChange={e => updateBlock(index, { label: e.target.value })}
              placeholder="What is this video about?"
              style={{ ...inputStyle, fontSize: 12 }}
            />
          </div>
        )
      case 'link':
        return (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={block.content.label ?? ''}
              onChange={e => updateBlock(index, { label: e.target.value })}
              placeholder="Link text"
              style={{ ...inputStyle, flex: 1, minWidth: 140 }}
            />
            <input
              value={block.content.url ?? ''}
              onChange={e => updateBlock(index, { url: e.target.value })}
              placeholder="https://..."
              style={{ ...inputStyle, flex: 2, minWidth: 200 }}
            />
          </div>
        )
      case 'callout':
        return (
          <div style={{ background: '#FEF9F1', border: '1px solid #E8A020', borderRadius: 8, padding: '10px 12px' }}>
            <textarea
              value={block.content.text ?? ''}
              onChange={e => updateBlock(index, { text: e.target.value })}
              placeholder="Important note learners should not miss"
              rows={2}
              style={{ ...inputStyle, border: 'none', padding: 0, background: 'transparent', resize: 'none', color: '#633806' }}
            />
          </div>
        )
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title="Notes builder"
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
              {saving ? 'Saving...' : 'Publish note'}
            </button>
          </div>
        }
      />

      <div style={{ padding: '28px 32px 60px', maxWidth: 760 }}>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>{error}</p>
        )}

        {/* Note meta */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {COVER_COLORS.map(c => (
              <button key={c} onClick={() => setCoverColor(c)} style={{
                width: 22, height: 22, borderRadius: '50%', background: c,
                border: coverColor === c ? '2.5px solid var(--near-black)' : '2.5px solid transparent',
                cursor: 'pointer', padding: 0,
              }} aria-label={`Cover colour ${c}`} />
            ))}
          </div>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            style={{ ...inputStyle, width: 180, height: 34, padding: '0 10px', fontSize: 12 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'var(--mid-grey)' }}>
            <input type="checkbox" checked={isDownloadable} onChange={e => setIsDownloadable(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: coverColor }} />
            Learners can download this note
          </label>
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled note"
          style={{
            width: '100%', fontSize: 30, fontWeight: 800, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--near-black)', fontFamily: 'var(--font)',
            padding: '8px 0 4px', boxSizing: 'border-box', letterSpacing: '-0.02em',
            borderBottom: `3px solid ${coverColor}`, marginBottom: 20,
          }}
        />

        {/* Blocks */}
        {blocks.map((block, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: 6, padding: '6px 0 6px 28px' }}
            className="note-block"
          >
            {/* Block controls */}
            <div style={{
              position: 'absolute', left: 0, top: 8,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <button onClick={() => moveBlock(i, -1)} disabled={i === 0} title="Move up" style={{
                width: 18, height: 16, border: 'none', background: 'transparent',
                fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}>▲</button>
              <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} title="Move down" style={{
                width: 18, height: 16, border: 'none', background: 'transparent',
                fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}>▼</button>
              {blocks.length > 1 && (
                <button onClick={() => removeBlock(i)} title="Remove block" style={{
                  width: 18, height: 16, border: 'none', background: 'transparent',
                  fontSize: 11, color: 'var(--coral)', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}>×</button>
              )}
            </div>

            {renderBlockEditor(block, i)}

            {/* Add-block trigger */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpenAt(menuOpenAt === i ? null : i)} style={{
                marginTop: 4, height: 24, padding: '0 10px', borderRadius: 12,
                border: '1px dashed var(--border)', background: 'transparent',
                fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                + Add block below
              </button>
              {menuOpenAt === i && (
                <div style={{
                  position: 'absolute', top: 30, left: 0, zIndex: 50,
                  background: 'var(--white)', borderRadius: 10, border: '0.5px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 6, width: 220,
                }}>
                  {BLOCK_MENU.map(m => (
                    <button key={m.type} onClick={() => insertBlock(i, m.type)} style={{
                      width: '100%', display: 'block', padding: '8px 10px', borderRadius: 7,
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{m.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>{m.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
