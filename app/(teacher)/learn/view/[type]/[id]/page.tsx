'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { GuideViewer, NoteViewer, DocumentViewer } from '@/components/brand/ResourceViewers'
import PublishToMarketplaceModal from '@/components/brand/PublishToMarketplaceModal'
import type { Document, Guide, Note } from '@/lib/types'
import type { PublishableResourceType } from '@/lib/marketplace-publish'

const TABLE: Record<string, string> = { guide: 'guides', notes: 'notes', document: 'documents' }
const TYPE_LABEL: Record<string, string> = { guide: 'Guide', notes: 'Notes', document: 'Document' }
const EDIT_HREF: Record<string, string> = {
  guide: '/learn/guide/builder',
  notes: '/learn/notes/builder',
  document: '/learn/documents/builder',
}

export default function CreatorResourcePreviewPage({
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
  const [showPublish, setShowPublish] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      const table = TABLE[params.type]
      if (!table) { setNotFound(true); setLoading(false); return }

      const user = getCurrentUser()
      // Own content in any publish state: creator's own, or their institution's.
      const filter = user.institution_id
        ? `creator_id.eq.${user.id},institution_id.eq.${user.institution_id}`
        : `creator_id.eq.${user.id}`

      const { data } = await supabase.from(table).select('*').eq('id', params.id).or(filter).maybeSingle()
      if (!data) { setNotFound(true); setLoading(false); return }

      if (params.type === 'guide') setGuide(data as Guide)
      else if (params.type === 'notes') setNote(data as Note)
      else setDocument(data as Document)
      setLoading(false)
    }
    load()
  }, [params.type, params.id, reloadKey])

  const resource = guide ?? note ?? document
  const title = resource?.title ?? ''
  const accent = resource?.cover_color ?? '#1A8966'
  const isPublished = resource?.is_published ?? false

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="learn"
        title="Preview"
        left={
          <Link href="/learn" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Learn
          </Link>
        }
      />

      <div style={{ padding: '24px 32px 60px', maxWidth: 720 }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Opening preview...</p>
        ) : notFound || !resource ? (
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>Resource not found</p>
            <Link href="/learn" style={{ fontSize: 13, color: '#1A8966', fontWeight: 600, textDecoration: 'none' }}>Back to Learn</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>
                    {TYPE_LABEL[params.type]}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: isPublished ? '#1A8966' : '#6B6870',
                    background: isPublished ? '#DDFAF0' : '#EDECE9',
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h1>
                {guide?.description && (
                  <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginTop: 8, lineHeight: 1.6 }}>{guide.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={EDIT_HREF[params.type]} style={{
                  height: 36, padding: '0 16px', borderRadius: 7,
                  border: '1px solid var(--border)', background: 'var(--white)',
                  fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}>
                  Create another
                </Link>
                <button
                  onClick={() => setShowPublish(true)}
                  disabled={!isPublished}
                  title={isPublished ? undefined : 'Publish this resource first, then list it'}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
                    background: isPublished ? '#1A8966' : 'var(--bg2)',
                    color: isPublished ? '#fff' : 'var(--mid-grey)',
                    fontSize: 13, fontWeight: 600,
                    cursor: isPublished ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}
                >
                  Marketplace
                </button>
              </div>
            </div>

            {guide && <GuideViewer guide={guide} accent={accent} />}
            {note && <NoteViewer blocks={note.blocks ?? []} title={note.title} downloadable={note.is_downloadable} />}
            {document && <DocumentViewer document={document} />}

            {resource && (
              <PublishToMarketplaceModal
                open={showPublish}
                onClose={() => setShowPublish(false)}
                onPublished={() => setReloadKey(k => k + 1)}
                resourceType={params.type as PublishableResourceType}
                resourceId={params.id}
                defaultTitle={title}
                defaultDescription={guide?.description}
                defaultSubject={resource.subject}
                defaultColor={accent}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
