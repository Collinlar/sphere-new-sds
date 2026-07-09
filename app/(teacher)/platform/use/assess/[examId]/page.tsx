'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { assertCanTakeAcquired, getOrCreateSelfExamSession } from '@/lib/self-take'

export default function SelfTakeAssessPage({ params: paramsPromise }: { params: Promise<{ examId: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function start() {
      const user = getCurrentUser()
      const gate = await assertCanTakeAcquired('exams', params.examId)
      if (!gate.ok) {
        if (!cancelled) {
          setError(gate.error)
          setLoading(false)
        }
        return
      }

      const sessionResult = await getOrCreateSelfExamSession(params.examId, user.id, user.name)
      if (!sessionResult.ok) {
        if (!cancelled) {
          setError(sessionResult.error)
          setLoading(false)
        }
        return
      }

      const { joinCode, resumeSubmissionId } = sessionResult
      const qs = new URLSearchParams({ self: '1' })
      if (resumeSubmissionId) qs.set('resume', resumeSubmissionId)
      if (!cancelled) {
        router.replace(`/student/assess/${joinCode}?${qs.toString()}`)
      }
    }

    start()
    return () => {
      cancelled = true
    }
  }, [params.examId, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Take assessment" />
      <div style={{ padding: '48px 32px', maxWidth: 480 }}>
        {loading && !error && (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Setting up your assessment...</p>
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
