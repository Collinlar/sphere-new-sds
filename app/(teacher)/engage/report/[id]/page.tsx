'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { fetchSessionReport, type SessionReport } from '@/lib/engage-history'

function playedOn(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function barColour(pct: number): string {
  if (pct >= 70) return '#1A8966'
  if (pct >= 40) return '#D97010'
  return '#C23B2A'
}

export default function EngageSessionReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<SessionReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionReport(id).then(r => { setReport(r); setLoading(false) })
  }, [id])

  const card = {
    background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
    borderRadius: 10, padding: '20px 22px',
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="engage"
        title={report ? report.session.quizTitle : 'Game report'}
        right={
          <Link href="/engage/history">
            <button style={{
              background: 'transparent', boxShadow: 'var(--shadow-soft)', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500,
              color: 'var(--near-black)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              All past games
            </button>
          </Link>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
            Putting the game back together...
          </div>
        )}

        {!loading && !report && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 32px' }}>
            <p style={{ fontSize: 15, color: 'var(--near-black)', marginBottom: 6 }}>We could not find that game.</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>It may have been deleted, or the link is out of date.</p>
          </div>
        )}

        {!loading && report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
            {/* Header numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
              {[
                { label: 'Played', value: playedOn(report.session.playedAt) },
                { label: 'Mode', value: report.session.modeLabel },
                { label: 'Players', value: String(report.session.players) },
                { label: 'Avg score', value: String(report.session.avgScore) },
              ].map(s => (
                <div key={s.label} style={card}>
                  <p style={{ fontSize: 11, color: 'var(--mid-grey)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.3 }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* What to reteach. This is the whole point of keeping the game. */}
            {report.weakest.length > 0 && (
              <div style={{ ...card, background: '#FEF3E2', boxShadow: 'none', border: '0.5px solid #E8A020' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#633806', marginBottom: 10 }}>
                  Worth going over again
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {report.weakest.map(q => (
                    <div key={q.index}>
                      <p style={{ fontSize: 14, color: 'var(--near-black)', fontWeight: 500, lineHeight: 1.5 }}>
                        Q{q.index + 1}. {q.text}
                      </p>
                      <p style={{ fontSize: 13, color: '#633806', marginTop: 2 }}>
                        {q.pctCorrect}% got it. {q.misconception ?? `The answer was ${q.correctLabel}.`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question by question */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>Question by question</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {report.questions.map(q => (
                  <div key={q.index} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 10 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', lineHeight: 1.5 }}>
                        Q{q.index + 1}. {q.text}
                      </p>
                      <span style={{ fontSize: 18, fontWeight: 700, color: barColour(q.pctCorrect), flexShrink: 0 }}>
                        {q.type === 'poll' ? '—' : `${q.pctCorrect}%`}
                      </span>
                    </div>

                    {q.type !== 'poll' && (
                      <>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--light-grey, #F3F4F6)', overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${q.pctCorrect}%`, height: '100%', background: barColour(q.pctCorrect), borderRadius: 4 }} />
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--mid-grey)', marginBottom: 10 }}>
                          {q.correct} of {q.answered} got it. Answer: {q.correctLabel}
                        </p>
                      </>
                    )}

                    {q.topAnswers.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {q.topAnswers.map(a => (
                          <div key={a.answer} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: q.type === 'poll' ? 'var(--mid-grey)' : a.correct ? '#1A8966' : '#C23B2A',
                            }} />
                            <span style={{
                              flex: 1, fontSize: 13, color: 'var(--near-black)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {a.display}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mid-grey)' }}>{a.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.answered === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Nobody answered this one.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Who played */}
            {report.teams.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>Teams</h2>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {report.teams.map(t => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--near-black)' }}>{t.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{t.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.players.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>Players</h2>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {report.players.map((p, i) => (
                    <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--mid-grey)', width: 22, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--near-black)' }}>
                        {p.name}
                        {p.teamName && (
                          <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}> · {p.teamName}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
