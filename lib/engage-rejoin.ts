'use client'

// Remembering a player's seat in a live game.
//
// Engage is played by guests with no account: a name and a code, nothing
// else. Until now that identity lived only in React state, so any reload
// dropped the player back to the join screen and a second tap created a
// SECOND participant. On a classroom phone that loses signal for a moment,
// that meant a student lost their score and burned another slot against the
// host's session cap, sometimes locking themselves out of their own game.
//
// The seat is stored per game code so two games never collide, and it is
// always re-checked against the database before it is trusted: a seat whose
// participant has been removed is stale and must not be restored.

const KEY_PREFIX = 'sphere_engage_seat_'

export interface EngageSeat {
  participantId: string
  sessionId: string
  displayName: string
}

function keyFor(code: string): string {
  return `${KEY_PREFIX}${code.trim().toUpperCase()}`
}

export function saveEngageSeat(code: string, seat: EngageSeat): void {
  if (typeof window === 'undefined' || !code) return
  try {
    window.localStorage.setItem(keyFor(code), JSON.stringify(seat))
  } catch {
    // Private browsing or a full quota. Losing the seat is recoverable;
    // failing the join is not.
  }
}

export function readEngageSeat(code: string): EngageSeat | null {
  if (typeof window === 'undefined' || !code) return null
  try {
    const raw = window.localStorage.getItem(keyFor(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EngageSeat>
    if (!parsed?.participantId || !parsed?.sessionId) return null
    return {
      participantId: parsed.participantId,
      sessionId: parsed.sessionId,
      displayName: parsed.displayName ?? '',
    }
  } catch {
    return null
  }
}

export function clearEngageSeat(code: string): void {
  if (typeof window === 'undefined' || !code) return
  try {
    window.localStorage.removeItem(keyFor(code))
  } catch {
    /* nothing to do */
  }
}
