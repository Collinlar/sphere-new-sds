import type { QuizQuestion } from './types'

// Split-information co-op.
//
// Every team member sees the same question but only part of the answer set,
// and exactly one of them holds the correct option. Nobody can answer alone,
// so the team has to say out loud what they are looking at. That forced
// verbalising is the point: it is the one format here where a quiet student
// cannot coast and a confident one cannot answer for everybody.
//
// The deal is computed identically on every device from the session id, the
// question index and the sorted member list, so no coordination round trip
// is needed and phones that reconnect still agree.

/** Deterministic 32-bit hash, so every client derives the same deal. */
function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small seeded PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface SplitDeal {
  /** Member id to the option labels that member can see. */
  byMember: Record<string, string[]>
  /** Which member holds the correct option. */
  holderId: string | null
}

/**
 * Deal a question's options across a team.
 *
 * Members are sorted before dealing so the result does not depend on the
 * order a device happened to load them in. Where a team has more members
 * than options, the extras receive duplicates of WRONG options only, so the
 * correct answer stays in exactly one pair of hands.
 */
export function dealOptions(params: {
  sessionId: string
  questionIndex: number
  memberIds: string[]
  question: QuizQuestion
}): SplitDeal {
  const { sessionId, questionIndex, question } = params
  const memberIds = [...params.memberIds].sort()

  const byMember: Record<string, string[]> = {}
  memberIds.forEach(id => { byMember[id] = [] })

  const labels = question.options.map(o => o.label)
  if (memberIds.length === 0 || labels.length === 0) {
    return { byMember, holderId: null }
  }

  const rand = seededRandom(hashSeed(`${sessionId}:${questionIndex}`))
  const shuffled = seededShuffle(labels, rand)

  // Round-robin deal. With four options across four members everyone holds
  // one; across two members everyone holds two.
  shuffled.forEach((label, i) => {
    const owner = memberIds[i % memberIds.length]
    byMember[owner].push(label)
  })

  const correctLabel = question.correct
  let holderId =
    memberIds.find(id => byMember[id].includes(correctLabel)) ?? null

  // More members than options: anyone left empty gets a wrong option to hold,
  // never the correct one, so the answer is still in a single place.
  const wrongLabels = labels.filter(l => l !== correctLabel)
  if (wrongLabels.length > 0) {
    memberIds.forEach((id, idx) => {
      if (byMember[id].length === 0) {
        byMember[id].push(wrongLabels[idx % wrongLabels.length])
      }
    })
  }

  // A question with no correct option (a poll) has no holder.
  if (!labels.includes(correctLabel)) holderId = null

  return { byMember, holderId }
}
