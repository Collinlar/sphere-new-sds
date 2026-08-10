'use client'

import type { QuizQuestion } from '@/lib/types'
import AnswerSurface from './AnswerSurface'

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
  // Only option-based questions can be split. A typed number, a sequence or
  // free text has nothing to deal out, so the team answers it in full and
  // still has to agree before anyone sends it.
  const splittable = ['mcq', 'true_false', 'multi_select', 'poll'].includes(question.type)
  const myOptions = splittable
    ? question.options.filter(o => myLabels.includes(o.label))
    : question.options

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
          {splittable
            ? 'Only one person in your team can see the right answer. Say your options out loud and decide together.'
            : 'This one cannot be split. Agree as a team before anyone sends an answer.'}
        </p>
      </div>

      {splittable && (
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
          {myOptions.length === 1 ? 'Your option' : 'Your options'}
        </p>
      )}

      {/* The deal needs the team roster, which arrives a moment after the
          question does. Say so rather than showing an empty list. */}
      {splittable && myLabels.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Dealing your options...</p>
        </div>
      ) : (
        <AnswerSurface
          question={question}
          disabled={locked}
          selected={selected}
          visibleLabels={splittable ? myLabels : undefined}
          onAnswer={onAnswer}
        />
      )}

      {locked && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
          Answer sent for your team. Waiting for the reveal...
        </p>
      )}
    </div>
  )
}
