'use client'

import type { EngageTeam, SessionParticipant } from '@/lib/types'

export function TeamHostLobby({
  joinCode,
  teams,
  participants,
  onStart,
}: {
  joinCode: string
  teams: EngageTeam[]
  participants: SessionParticipant[]
  onStart: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 22 }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
          Team Mode · Join code
        </p>
        <p style={{ fontSize: 48, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>{joinCode}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
          {participants.length} students joined · {teams.length} teams auto-assigned
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 560, marginBottom: 22 }}>
        {teams.map(t => {
          const members = participants.filter(p => p.team_id === t.id)
          return (
            <div key={t.id} style={{
              background: `${t.color}33`, border: `0.5px solid ${t.color}66`, borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, background: `${t.color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: t.color,
                }}>{t.letter}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.color, marginLeft: 'auto' }}>{members.length} members</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {members.slice(0, 3).map(m => (
                  <span key={m.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 20 }}>
                    {m.display_name.split(' ')[0]}
                  </span>
                ))}
                {members.length > 3 && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 20 }}>
                    +{members.length - 3}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          width: '100%', maxWidth: 560, height: 52, background: 'var(--violet)', border: 'none',
          borderRadius: 10, fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Start team game →
      </button>
    </div>
  )
}

export function TeamHostScores({
  teams,
  questionLabel,
  correctLabel,
}: {
  teams: EngageTeam[]
  questionLabel: string
  correctLabel: string
}) {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  const maxScore = sorted[0]?.score || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
      {sorted.map((t, i) => (
        <div key={t.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 6, background: `${t.color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: t.color,
            }}>{t.letter}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>{t.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.score} pts</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(t.score / maxScore) * 100}%`, height: '100%', background: t.color, borderRadius: 5 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{questionLabel}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? t.color : 'rgba(255,255,255,0.35)' }}>
              {i === 0 ? '1st' : `${i + 1}${i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`}
            </span>
          </div>
        </div>
      ))}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 16px', marginTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
          Correct answer: <span style={{ color: '#fff' }}>{correctLabel}</span>
        </p>
      </div>
    </div>
  )
}

export function TeamHostFinal({ teams }: { teams: EngageTeam[] }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 24 }}>
      <p style={{ fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
        Final team standings
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 440 }}>
        {sorted.map((t, i) => (
          <div key={t.id} style={{
            background: i === 0 ? `${t.color}33` : 'rgba(255,255,255,0.05)',
            border: `0.5px solid ${i === 0 ? `${t.color}80` : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? t.color : 'rgba(255,255,255,0.3)', width: 22 }}>{i + 1}</span>
            <span style={{
              width: 28, height: 28, borderRadius: 8, background: `${t.color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: t.color,
            }}>{t.letter}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? t.color : 'rgba(255,255,255,0.5)' }}>{t.score}</span>
          </div>
        ))}
      </div>
      <a href="/engage" style={{
        marginTop: 16, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
        borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none',
      }}>
        Back to Engage
      </a>
    </div>
  )
}
