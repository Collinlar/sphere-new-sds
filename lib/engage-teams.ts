export const TEAM_PRESETS = [
  { name: 'Team Moon', letter: 'M', color: '#2E2886' },
  { name: 'Team Star', letter: 'S', color: '#1052A3' },
  { name: 'Team Blaze', letter: 'B', color: '#D97010' },
  { name: 'Team Wave', letter: 'W', color: '#1A8966' },
  { name: 'Team Peak', letter: 'P', color: '#C23B2A' },
  { name: 'Team Nova', letter: 'N', color: '#6B6870' },
] as const

export interface TeamModeSettings {
  game_mode: 'competitive' | 'team'
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
