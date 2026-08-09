'use client'

import type { QuizQuestion } from '@/lib/types'

const ANSWER_COLORS: Record<string, string> = {
  A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010',
}

/**
 * Split-information co-op play surface.
 *
 * The learner sees the question in full but only the options dealt to them,
 * and only one person in the team is holding the right one. The instruction
 * to talk is the mechanic, not decoration: without saying what is on your
 * screen the team cannot find the answer at all.
 */
export default function SplitCoOpAnswer({
  question,
  myLabels,
  locked,
  selected,
  onAnswer,
}: {
  question: QuizQuestion
  myLabels: string[]
  locked: boolean
  selected: string | null
  onAnswer: (label: string) => void
}) {
  const myOptions = question.options.filter(o => myLabels.includes(o.label))

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '22px 20px', marginBottom: 16, textAlign: 'center',
      }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{question.text}</p>
      </div>

      <div style={{
        background: 'rgba(46,40,134,0.28)', border: '0.5px solid rgba(255,255,255,0.16)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
      }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, textAlign: 'center' }}>
          Only one person in your team can see the right answer. Say your options out loud and decide together.
        </p>
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
        {myOptions.length === 1 ? 'Your option' : 'Your options'}
      </p>

      {/* The deal needs the team roster, which arrives a moment after the
          question does. Say so rather than showing an empty list. */}
      {myOptions.length === 0 && (
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Dealing your options...</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {myOptions.map(opt => (
          <button
            key={opt.label}
            onClick={() => onAnswer(opt.label)}
            disabled={locked}
            style={{
              width: '100%',
              background: selected === opt.label
                ? ANSWER_COLORS[opt.label] ?? '#2E2886'
                : `${ANSWER_COLORS[opt.label] ?? '#2E2886'}CC`,
              border: 'none', borderRadius: 12, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: locked ? 'default' : 'pointer',
              opacity: selected && selected !== opt.label ? 0.5 : 1,
              minHeight: 64, textAlign: 'left',
            }}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.25)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{opt.label}</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>{opt.text}</span>
          </button>
        ))}
      </div>

      {locked && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
          Answer sent for your team. Waiting for the reveal...
        </p>
      )}
    </div>
  )
}
