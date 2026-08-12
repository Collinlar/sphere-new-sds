'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { fetchScopedContent, resolveLibraryScope } from '@/lib/library-scope'
import { fetchSessionHistory, type SessionSummary } from '@/lib/engage-history'
import { onContextChange } from '@/lib/context'
import type { Quiz } from '@/lib/types'

function playedOn(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function EngageHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const scope = resolveLibraryScope()
      const quizzes = await fetchScopedContent<Quiz>('quizzes', scope)
      setSessions(await fetchSessionHistory(quizzes.map(q => q.id)))
      setLoading(false)
    }
    load()
    return onContextChange(() => setReloadKey(k => k + 1))
  }, [reloadKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="engage"
        title="Past games"
        right={
          <Link href="/engage">
            <button style={{
              background: 'transparent', boxShadow: 'var(--shadow-soft)', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500,
              color: 'var(--near-black)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Back to Engage
            </button>
          </Link>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
            Pulling up the games you have run...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{
            background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
            borderRadius: 10, padding: '56px 32px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 8 }}>
              No finished games yet
            </p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
              Once you host a game and end it, the full breakdown lands here: who played, what the class scored, and which questions they struggled with.
            </p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map(s => (
              <Link key={s.id} href={`/engage/report/${s.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10,
                  padding: '16px 20px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16, cursor: 'pointer',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{s.quizTitle}</p>
                      <span style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--near-black)', background: 'var(--light-grey, #F3F4F6)',
                        padding: '2px 7px', borderRadius: 4,
                      }}>
                        {s.modeLabel}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--mid-grey)', flexWrap: 'wrap' }}>
                      <span>{playedOn(s.playedAt)}</span>
                      <span>{s.players} {s.players === 1 ? 'player' : 'players'}</span>
                      <span>{s.questions} questions</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.2 }}>{s.avgScore}</p>
                    <p style={{ fontSize: 11, color: 'var(--mid-grey)' }}>avg score</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
