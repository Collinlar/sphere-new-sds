'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { assertCanTakeAcquired, getOrCreateSelfEngageSession } from '@/lib/self-take'

export default function SelfPlayEngagePage({ params: paramsPromise }: { params: Promise<{ quizId: string }> }) {
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
          setError('Sign in to play this quiz from your library.')
          setLoading(false)
        }
        return
      }

      const gate = await assertCanTakeAcquired('quizzes', params.quizId)
      if (!gate.ok) {
        if (!cancelled) {
          setError(gate.error)
          setLoading(false)
        }
        return
      }

      const sessionResult = await getOrCreateSelfEngageSession(params.quizId, user.id, user.name)
      if (!sessionResult.ok) {
        if (!cancelled) {
          setError(sessionResult.error)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        router.replace(
          `/platform/use/engage/${params.quizId}/play?session=${sessionResult.session.id}&participant=${sessionResult.participantId}`,
        )
      }
    }

    start()
    return () => {
      cancelled = true
    }
  }, [params.quizId, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Play quiz" />
      <div style={{ padding: '48px 32px', maxWidth: 480 }}>
        {loading && !error && (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Setting up your practice session...</p>
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
