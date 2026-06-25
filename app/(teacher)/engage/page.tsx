'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { Quiz } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'

interface QuizStats {
  totalPlays: number
  avgScore: number
  activeSessions: number
}

export default function EngageDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [stats, setStats] = useState<QuizStats>({ totalPlays: 0, avgScore: 0, activeSessions: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('institution_id', getCurrentUser().institution_id)
        .order('created_at', { ascending: false })

      if (error) {
        setError('Could not load your quizzes right now. Try refreshing.')
        setLoading(false)
        return
      }

      setQuizzes(data ?? [])

      const { data: sessions } = await supabase
        .from('engage_sessions')
        .select('id, status')
        .eq('status', 'active')

      setStats({
        totalPlays: 0,
        avgScore: 0,
        activeSessions: sessions?.length ?? 0,
      })

      setLoading(false)
    }

    load()
  }, [])

  const handleHost = async (quiz: Quiz) => {
    const { generateJoinCode } = await import('@/lib/utils')
    const code = generateJoinCode(6)

    const { data, error } = await supabase
      .from('engage_sessions')
      .insert({
        quiz_id: quiz.id,
        host_id: getCurrentUser().id,
        join_code: code,
        status: 'lobby',
        current_question_index: 0,
        settings: {},
      })
      .select()
      .single()

    if (error || !data) {
      alert('Could not create a session. Check your connection and try again.')
      return
    }

    window.location.href = `/engage/session/${data.id}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="engage"
        title="Engage"
        right={
          <Link href="/engage/builder">
            <button style={{
              background: '#EF9F27',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              + New Quiz
            </button>
          </Link>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Quizzes created', value: loading ? '...' : quizzes.length },
            { label: 'Active sessions', value: loading ? '...' : stats.activeSessions },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'var(--white)',
              border: '0.5px solid var(--border)',
              borderRadius: 10,
              padding: '18px 20px',
            }}>
              <p style={{ fontSize: 11, color: 'var(--mid-grey)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Quiz list */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>My quizzes</h2>
        </div>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
            Pulling your quizzes from the classroom...
          </div>
        )}

        {error && (
          <div style={{
            background: '#FDECEA',
            border: '0.5px solid #E05C4B',
            borderRadius: 10,
            padding: '16px 20px',
            color: '#7A1A10',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && quizzes.length === 0 && (
          <div style={{
            background: 'var(--white)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            padding: '56px 32px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🎯</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
              No quizzes yet
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>
              Build your first quiz and run it live with your class.
            </p>
            <Link href="/engage/builder">
              <button style={{
                background: '#EF9F27',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Create your first quiz
              </button>
            </Link>
          </div>
        )}

        {!loading && !error && quizzes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quizzes.map((quiz) => (
              <div key={quiz.id} style={{
                background: 'var(--white)',
                border: '0.5px solid var(--border)',
                borderRadius: 10,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{quiz.title}</p>
                    {quiz.is_published && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#085041',
                        background: '#E1F5EE',
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}>
                        Published
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--mid-grey)' }}>
                    {quiz.subject && <span>{quiz.subject}</span>}
                    {quiz.grade_level && <span>{quiz.grade_level}</span>}
                    <span>{quiz.questions?.length ?? 0} questions</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/engage/builder?edit=${quiz.id}`}>
                    <button style={{
                      background: 'transparent',
                      border: '0.5px solid var(--border)',
                      borderRadius: 7,
                      padding: '7px 14px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--near-black)',
                      cursor: 'pointer',
                    }}>
                      Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => handleHost(quiz)}
                    style={{
                      background: '#EF9F27',
                      border: 'none',
                      borderRadius: 7,
                      padding: '7px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Host
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
