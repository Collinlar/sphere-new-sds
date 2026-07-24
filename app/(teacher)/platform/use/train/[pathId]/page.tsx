'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { assertCanTakeAcquired, ensurePathEnrollment } from '@/lib/self-take'

export default function SelfUseTrainPage({ params: paramsPromise }: { params: Promise<{ pathId: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function start() {
      const user = getCurrentUser()
      if (!user?.id) {
        if (!cancelled) {
          setError('Sign in to start this training from your library.')
          setLoading(false)
        }
        return
      }

      const gate = await assertCanTakeAcquired('learning_paths', params.pathId)
      if (!gate.ok) {
        if (!cancelled) {
          setError(gate.error)
          setLoading(false)
        }
        return
      }

      const enrolled = await ensurePathEnrollment(params.pathId, user.id)
      if (!enrolled.ok) {
        if (!cancelled) {
          setError(enrolled.error)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        router.replace(`/student/train/${params.pathId}?from=library`)
      }
    }

    start()
    return () => { cancelled = true }
  }, [params.pathId, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Start training" />
      <div style={{ padding: '48px 32px', maxWidth: 480 }}>
        {loading && !error && (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Opening your training path...</p>
        )}
        {error && (
          <>
            <p style={{ fontSize: 14, color: 'var(--coral)', marginBottom: 16, lineHeight: 1.5 }}>{error}</p>
            <Link
              href="/platform/library"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none' }}
            >
              Back to library
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
