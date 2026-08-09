export const TEAM_PRESETS = [
  { name: 'Team Moon', letter: 'M', color: '#2E2886' },
  { name: 'Team Star', letter: 'S', color: '#1052A3' },
  { name: 'Team Blaze', letter: 'B', color: '#D97010' },
  { name: 'Team Wave', letter: 'W', color: '#1A8966' },
  { name: 'Team Peak', letter: 'P', color: '#C23B2A' },
  { name: 'Team Nova', letter: 'N', color: '#6B6870' },
] as const

export type EngageGameMode = 'competitive' | 'team' | 'co_op' | 'one_screen'

/**
 * Does this mode run on teams?
 *
 * Kept in one place on purpose. This test used to be written out at each call
 * site, and adding co-op meant every one of them had to be found and updated.
 * One was missed, players were never assigned a team, and the play screen
 * rendered empty. A single predicate makes that failure impossible to repeat.
 */
export function usesTeams(mode: string | undefined | null): boolean {
  return mode === 'team' || mode === 'co_op' || mode === 'one_screen'
}

/** Team play where each member sees only part of the answer set. */
export function isSplitCoOp(mode: string | undefined | null): boolean {
  return mode === 'co_op'
}

export interface TeamModeSettings {
  game_mode: EngageGameMode
  team_formation?: 'auto' | 'pick'
  team_size?: '2' | '3-4' | '5+'
  consensus_bonus?: boolean
  discussion_seconds?: number
  time_per_question?: number
}

export function teamSizeMax(size: string | undefined): number {
  if (size === '2') return 2
  if (size === '5+') return 6
  return 4
}

export function teamSizeMin(size: string | undefined): number {
  if (size === '2') return 2
  if (size === '5+') return 5
  return 3
}

export function assignTeamIndex(participantIndex: number, teamCount: number): number {
  return participantIndex % teamCount
}

export interface EngageTeam {
  id: string
  session_id: string
  name: string
  letter: string
  color: string
  score: number
}
