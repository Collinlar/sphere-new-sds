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
  const [launching, setLaunching] = useState<Quiz | null>(null)
  const [timePerQuestion, setTimePerQuestion] = useState(30)
  const [gameMode, setGameMode] = useState<'competitive' | 'team'>('competitive')
  const [teamFormation, setTeamFormation] = useState<'auto' | 'pick'>('auto')
  const [teamSize, setTeamSize] = useState<'2' | '3-4' | '5+'>('3-4')
  const [consensusBonus, setConsensusBonus] = useState(true)
  const [discussionSeconds, setDiscussionSeconds] = useState(30)
  const [starting, setStarting] = useState(false)

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

  const handleLaunch = async () => {
    if (!launching) return
    setStarting(true)
    const { generateJoinCode } = await import('@/lib/utils')
    const code = generateJoinCode(6)

    const { data, error } = await supabase
      .from('engage_sessions')
      .insert({
        quiz_id: launching.id,
        host_id: getCurrentUser().id,
        join_code: code,
        status: 'lobby',
        current_question_index: 0,
        settings: {
          time_per_question: timePerQuestion,
          game_mode: gameMode,
          team_formation: teamFormation,
          team_size: teamSize,
          consensus_bonus: consensusBonus,
          discussion_seconds: discussionSeconds,
        },
      })
      .select()
      .single()

    if (error || !data) {
      alert('Could not create a session. Check your connection and try again.')
      setStarting(false)
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
              background: '#D97010',
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
              boxShadow: 'var(--shadow-soft)',
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
            border: '0.5px solid #C23B2A',
            borderRadius: 10,
            padding: '16px 20px',
            color: '#C23B2A',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && quizzes.length === 0 && (
          <div style={{
            background: 'var(--white)',
            boxShadow: 'var(--shadow-soft)',
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
                background: '#D97010',
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
                boxShadow: 'var(--shadow-soft)',
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
                        color: '#1A8966',
                        background: '#DDFAF0',
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
                      boxShadow: 'var(--shadow-soft)',
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
                    onClick={() => { setLaunching(quiz); setTimePerQuestion(30); setGameMode('competitive') }}
                    style={{
                      background: '#D97010',
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

      {/* Create game modal */}
      {launching && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24,
        }}>
          <div style={{ background: 'var(--page-bg)', borderRadius: 16, boxShadow: 'var(--shadow-card)', padding: '32px 28px 36px', width: '100%', maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)' }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>New game</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>Quiz</label>
                <div style={{ height: 46, background: 'var(--white)', borderRadius: 8, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-soft)' }}>
                  <span style={{ fontSize: 14, color: 'var(--near-black)' }}>{launching.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{launching.questions?.length ?? 0} questions</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>Time per question</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[30, 60, 90].map(t => (
                    <button
                      key={t}
                      onClick={() => setTimePerQuestion(t)}
                      style={{
                        height: 38, flex: 1, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: timePerQuestion === t ? 'var(--amber)' : 'var(--white)',
                        color: timePerQuestion === t ? '#fff' : 'var(--mid-grey)',
                        fontSize: 13, fontWeight: timePerQuestion === t ? 600 : 500,
                        boxShadow: timePerQuestion === t ? 'none' : 'var(--shadow-soft)',
                      }}
                    >
                      {t} sec
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 7 }}>Game mode</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { key: 'competitive', label: 'Competitive' },
                    { key: 'team', label: 'Team' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setGameMode(opt.key)}
                      style={{
                        height: 38, flex: 1, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: gameMode === opt.key ? 'var(--near-black)' : 'var(--white)',
                        color: gameMode === opt.key ? '#fff' : 'var(--mid-grey)',
                        fontSize: 13, fontWeight: gameMode === opt.key ? 600 : 500,
                        boxShadow: gameMode === opt.key ? 'none' : 'var(--shadow-soft)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {gameMode === 'team' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Team formation</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([['auto', 'Auto-assign'], ['pick', 'Let students pick']] as const).map(([k, label]) => (
                          <button key={k} type="button" onClick={() => setTeamFormation(k)} style={{
                            height: 38, flex: 1, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            background: teamFormation === k ? 'var(--violet)' : 'var(--white)',
                            color: teamFormation === k ? '#fff' : 'var(--mid-grey)',
                            fontSize: 12, fontWeight: teamFormation === k ? 600 : 500,
                            boxShadow: teamFormation === k ? 'none' : 'var(--shadow-soft)',
                          }}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Team size</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['2', '3-4', '5+'] as const).map(s => (
                          <button key={s} type="button" onClick={() => setTeamSize(s)} style={{
                            height: 38, flex: 1, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            background: teamSize === s ? 'var(--violet)' : 'var(--bg2)',
                            color: teamSize === s ? '#fff' : 'var(--mid-grey)',
                            fontSize: 13, fontWeight: teamSize === s ? 600 : 500,
                          }}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>Consensus bonus</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+50 pts when all teammates agree</p>
                      </div>
                      <button type="button" onClick={() => setConsensusBonus(c => !c)} style={{
                        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: consensusBonus ? 'var(--violet)' : 'var(--bg2)', position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          left: consensusBonus ? 'auto' : 3, right: consensusBonus ? 3 : 'auto',
                        }} />
                      </button>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Discussion time per question</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[20, 30, 60].map(s => (
                          <button key={s} type="button" onClick={() => setDiscussionSeconds(s)} style={{
                            height: 38, flex: 1, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            background: discussionSeconds === s ? 'var(--violet)' : 'var(--bg2)',
                            color: discussionSeconds === s ? '#fff' : 'var(--mid-grey)',
                            fontSize: 13, fontWeight: discussionSeconds === s ? 600 : 500,
                          }}>{s}s</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleLaunch}
              disabled={starting}
              style={{
                width: '100%', height: 52, background: 'var(--amber)', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.7 : 1, fontFamily: 'inherit',
              }}
            >
              {starting ? 'Launching...' : gameMode === 'team' ? 'Create team game →' : 'Launch game →'}
            </button>

            <button
              onClick={() => setLaunching(null)}
              style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
