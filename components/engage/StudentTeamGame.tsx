'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EngageTeam } from '@/lib/types'
import { IconCheck } from '@/components/icons'

interface Props {
  sessionId: string
  team: EngageTeam
  participantId: string
  participantName: string
  code: string
}

export function StudentTeamLobby({ sessionId, team, participantId, participantName, code }: Props) {
  const [teammates, setTeammates] = useState<{ id: string; display_name: string }[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('session_participants')
        .select('id, display_name')
        .eq('session_id', sessionId)
        .eq('team_id', team.id)
      setTeammates((data ?? []).filter(m => m.id !== participantId))
    }
    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [sessionId, team.id, participantId])

  return (
    <div style={{ width: '100%', textAlign: 'center', color: '#fff' }}>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 24px', marginBottom: 28, display: 'inline-block' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
          Team Mode · Code {code.toUpperCase()}
        </span>
      </div>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: `${team.color}80`,
        border: `0.5px solid ${team.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontSize: 32, fontWeight: 800, color: team.color,
      }}>
        {team.letter}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>You&apos;re on</p>
      <p style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{team.name}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>
        {teammates.length + 1} teammates · waiting for others
      </p>
      <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your teammates</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {participantName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{participantName} (you)</span>
            <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)' }} />
          </div>
          {teammates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                {t.display_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{t.display_name}</span>
              <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)' }} />
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Waiting for teacher to start the game</p>
    </div>
  )
}

interface DiscussProps extends Props {
  questionText: string
  options: { label: string; text: string }[]
  questionIndex: number
  totalQuestions: number
  timeLeft: number
  onLock: (answer: string) => void
}

export function StudentTeamDiscuss({
  team, questionText, options, questionIndex, totalQuestions, timeLeft, onLock,
}: DiscussProps) {
  const [vote, setVote] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  function handleLock() {
    if (!vote || locked) return
    setLocked(true)
    onLock(vote)
  }

  return (
    <div style={{ width: '100%', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${team.color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: team.color }}>
            {team.letter}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{team.name}</span>
        </div>
        <div style={{ background: `${team.color}66`, borderRadius: 8, padding: '6px 14px' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{timeLeft}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 3 }}>sec</span>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
          Q{questionIndex + 1} of {totalQuestions} · Discuss with your team
        </p>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', lineHeight: 1.5 }}>{questionText}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
        {options.map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => !locked && setVote(opt.label)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              background: vote === opt.label ? `${team.color}40` : 'rgba(255,255,255,0.05)',
              border: vote === opt.label ? `0.5px solid ${team.color}` : '0.5px solid transparent',
              borderRadius: 9, cursor: locked ? 'default' : 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: vote === opt.label ? team.color : 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: vote === opt.label ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{opt.label}</span>
            <span style={{ fontSize: 13, fontWeight: vote === opt.label ? 600 : 400, color: vote === opt.label ? '#fff' : 'rgba(255,255,255,0.65)' }}>{opt.text}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleLock}
        disabled={!vote || locked}
        style={{
          width: '100%', height: 46, background: team.color, borderRadius: 9, border: 'none',
          fontSize: 14, fontWeight: 700, color: '#fff', cursor: locked ? 'default' : 'pointer',
          opacity: !vote || locked ? 0.6 : 1, fontFamily: 'inherit',
        }}
      >
        {locked ? 'Answer locked in' : 'Lock in team answer →'}
      </button>
    </div>
  )
}

export function StudentTeamResult({ team, correct, points, consensusBonus }: {
  team: EngageTeam
  correct: boolean
  points: number
  consensusBonus: number
  teamTotal: number
}) {
  return (
    <div style={{ textAlign: 'center', color: '#fff', width: '100%' }}>
      <div style={{
        width: 84, height: 84, borderRadius: '50%', background: team.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
        boxShadow: `0 0 0 12px ${team.color}26`,
      }}>
        {correct ? <IconCheck size={36} /> : <span style={{ fontSize: 28, fontWeight: 700 }}>✕</span>}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{team.name}</p>
      <p style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{correct ? 'Nailed it!' : 'Not this time'}</p>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px', width: '100%', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Points this question</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: team.color }}>+{points}</span>
        </div>
        {consensusBonus > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Team bonus (consensus)</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--amber)' }}>+{consensusBonus}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function StudentTeamFinal({ teams, myTeamId }: { teams: EngageTeam[]; myTeamId: string }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  return (
    <div style={{ width: '100%', color: '#fff' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Game over</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>Team standings</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((t, i) => {
          const isMine = t.id === myTeamId
          return (
            <div key={t.id} style={{
              background: isMine ? `${t.color}33` : 'rgba(255,255,255,0.05)',
              border: isMine ? `0.5px solid ${t.color}80` : '0.5px solid transparent',
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: isMine ? t.color : 'rgba(255,255,255,0.3)', width: 22 }}>{i + 1}</span>
              <span style={{
                width: 28, height: 28, borderRadius: 8, background: `${t.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: t.color,
              }}>{t.letter}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', flex: 1 }}>{t.name}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: isMine ? t.color : 'rgba(255,255,255,0.5)' }}>{t.score}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
