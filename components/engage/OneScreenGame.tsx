'use client'

import { useState } from 'react'
import type { EngageTeam, QuizQuestion } from '@/lib/types'
import { scoreSpokenAnswer } from '@/lib/engage-team-service'
import type { ScoringModel } from '@/lib/engage-scoring'

/**
 * One-screen mode: the whole class plays off a single device, projected or
 * held by the teacher. No student phones, no join code, no network on the
 * learner side.
 *
 * This is the primary mode for a lot of classrooms, not a fallback. Where
 * one device per student is unrealistic, a game that needs thirty handsets
 * is a game that never gets played.
 *
 * Teams confer out loud, the host taps who answered and what they said, and
 * the real option is recorded so the misconception panel still works.
 */
export default function OneScreenGame({
  sessionId,
  question,
  questionIndex,
  totalQuestions,
  teams,
  model,
  onTeamsChanged,
  onNext,
  isLast,
}: {
  sessionId: string
  question: QuizQuestion
  questionIndex: number
  totalQuestions: number
  teams: EngageTeam[]
  model: ScoringModel
  onTeamsChanged: (teams: EngageTeam[]) => void
  onNext: () => void
  isLast: boolean
}) {
  const [answeredBy, setAnsweredBy] = useState<Record<string, { label: string; correct: boolean; points: number }>>({})
  const [pickingFor, setPickingFor] = useState<EngageTeam | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState(false)

  async function recordAnswer(team: EngageTeam, label: string) {
    if (busy || answeredBy[team.id]) return
    setBusy(true)
    const result = await scoreSpokenAnswer({
      sessionId,
      teamId: team.id,
      questionIndex,
      question,
      answerLabel: label,
      model,
      totalQuestions,
    })
    setBusy(false)
    setPickingFor(null)
    setAnsweredBy(prev => ({ ...prev, [team.id]: { label, correct: result.correct, points: result.points } }))
    onTeamsChanged(
      teams.map(t => (t.id === team.id ? { ...t, score: t.score + result.points } : t))
    )
  }

  function next() {
    setAnsweredBy({})
    setRevealed(false)
    setPickingFor(null)
    onNext()
  }

  const allAnswered = teams.length > 0 && teams.every(t => answeredBy[t.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--navy, #14132A)' }}>
      {/* Question, sized to be read from the back of a classroom */}
      <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
          Question {questionIndex + 1} of {totalQuestions}
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 26 }}>
          {question.text}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {question.options.map(opt => {
            const isCorrect = opt.label === question.correct
            const show = revealed && question.type !== 'poll'
            return (
              <div
                key={opt.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: show && isCorrect ? 'rgba(26,137,102,0.35)' : 'rgba(255,255,255,0.07)',
                  border: show && isCorrect ? '1px solid #1A8966' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '14px 16px',
                }}
              >
                <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 17, color: '#fff', lineHeight: 1.4 }}>{opt.text}</span>
              </div>
            )
          })}
        </div>

        {/* After the reveal, name the error the class most likely made. */}
        {revealed && question.type !== 'poll' && (() => {
          const wrongPicks = Object.values(answeredBy).filter(a => !a.correct)
          if (wrongPicks.length === 0) return null
          const tally: Record<string, number> = {}
          wrongPicks.forEach(a => { tally[a.label] = (tally[a.label] ?? 0) + 1 })
          const topLabel = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
          const opt = question.options.find(o => o.label === topLabel)
          if (!opt?.why_wrong) return null
          return (
            <div style={{ marginTop: 20, background: 'rgba(232,160,32,0.14)', border: '0.5px solid rgba(232,160,32,0.5)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F5C86B', marginBottom: 6 }}>
                Worth reteaching
              </p>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>{opt.why_wrong}</p>
            </div>
          )
        })()}
      </div>

      {/* Team row. Tap a team to record what they said. */}
      <div style={{ padding: '18px 28px 26px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
          {pickingFor
            ? `What did ${pickingFor.name} answer?`
            : allAnswered
              ? 'Every team has answered.'
              : 'Tap a team once they have given their answer.'}
        </p>

        {pickingFor ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {question.options.map(opt => (
              <button
                key={opt.label}
                onClick={() => recordAnswer(pickingFor, opt.label)}
                disabled={busy}
                style={{
                  minWidth: 64, height: 56, padding: '0 20px', borderRadius: 12, border: 'none',
                  background: pickingFor.color, color: '#fff', fontSize: 20, fontWeight: 700,
                  cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setPickingFor(null)}
              style={{
                height: 56, padding: '0 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {teams.map(team => {
              const answer = answeredBy[team.id]
              return (
                <button
                  key={team.id}
                  onClick={() => setPickingFor(team)}
                  disabled={!!answer || busy}
                  style={{
                    minHeight: 68, borderRadius: 12, border: 'none', padding: '10px 14px',
                    background: answer
                      ? answer.correct ? 'rgba(26,137,102,0.3)' : 'rgba(194,59,42,0.28)'
                      : team.color,
                    color: '#fff', cursor: answer ? 'default' : 'pointer', fontFamily: 'inherit',
                    textAlign: 'left', opacity: answer ? 0.85 : 1,
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{team.name}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                    {answer
                      ? `${answer.label} · ${answer.correct ? `+${answer.points}` : 'no points'}`
                      : `${team.score} pts`}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              style={{
                height: 46, padding: '0 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Show the answer
            </button>
          )}
          <button
            onClick={next}
            style={{
              height: 46, padding: '0 24px', borderRadius: 10, border: 'none',
              background: 'var(--amber, #D97010)', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isLast ? 'Finish game' : 'Next question'}
          </button>
        </div>
      </div>
    </div>
  )
}
