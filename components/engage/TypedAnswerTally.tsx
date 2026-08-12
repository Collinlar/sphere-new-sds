'use client'

/**
 * The host-screen tally for questions with no A/B/C/D: a typed number, a
 * written answer, a sequence. There is nothing to chart by option, so this
 * shows how much of the room got there and what they wrote instead. The
 * wrong answers are the teaching material, which is why they are listed
 * verbatim rather than summed into a single "missed" number.
 */
export default function TypedAnswerTally({
  counts,
  answered,
  correct,
}: {
  counts: Record<string, number>
  answered: number
  correct: number
}) {
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
            {correct} of {answered} got it
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{pct}%</span>
        </div>
        <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 6,
            background: '#1A8966', transition: 'width 0.4s',
          }} />
        </div>
      </div>

      {top.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            What the room wrote
          </p>
          {top.map(([answer, count]) => (
            <div key={answer} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                flex: 1, fontSize: 15, color: '#fff', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {answer}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {answered === 0 && (
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
          Nobody has answered yet.
        </p>
      )}
    </div>
  )
}
