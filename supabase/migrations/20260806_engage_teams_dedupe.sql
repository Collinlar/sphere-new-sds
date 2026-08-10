-- =====================================================================
-- Duplicate teams in a live game.
--
-- THE BUG
--   ensureTeamsForSession read the team list, saw none, and inserted four.
--   The host page and every joining student call it, so two callers racing
--   each other both saw zero and both inserted. Sessions ended up with two
--   full sets of teams 115ms apart, and the host leaderboard listed
--   "Team Moon, Team Star, Team Blaze, Team Wave" twice, with players and
--   scores split across the copies.
--
-- THE FIX
--   Make it impossible at the database rather than hoping the race does
--   not happen: one team name per session, enforced. The application side
--   switches to an upsert that ignores conflicts and reads back, so a
--   losing racer simply picks up the winner's teams.
--
-- This migration also repairs existing sessions: for each duplicated name
-- it keeps the row carrying the score, repoints every participant and
-- response at it, then removes the strays.
--
-- Safe to re-run.
-- =====================================================================

-- Keep one row per (session_id, name): the highest scoring, oldest on ties.
WITH ranked AS (
  SELECT id, session_id, name,
         ROW_NUMBER() OVER (
           PARTITION BY session_id, name
           ORDER BY score DESC, created_at ASC, id ASC
         ) AS rn
  FROM engage_teams
),
keepers AS (
  SELECT r.id AS keep_id, r.session_id, r.name
  FROM ranked r WHERE r.rn = 1
),
strays AS (
  SELECT r.id AS stray_id, k.keep_id
  FROM ranked r
  JOIN keepers k ON k.session_id = r.session_id AND k.name = r.name
  WHERE r.rn > 1
)
UPDATE session_participants sp
SET team_id = s.keep_id
FROM strays s
WHERE sp.team_id = s.stray_id;

WITH ranked AS (
  SELECT id, session_id, name,
         ROW_NUMBER() OVER (
           PARTITION BY session_id, name
           ORDER BY score DESC, created_at ASC, id ASC
         ) AS rn
  FROM engage_teams
),
keepers AS (
  SELECT r.id AS keep_id, r.session_id, r.name
  FROM ranked r WHERE r.rn = 1
),
strays AS (
  SELECT r.id AS stray_id, k.keep_id
  FROM ranked r
  JOIN keepers k ON k.session_id = r.session_id AND k.name = r.name
  WHERE r.rn > 1
)
UPDATE session_responses sr
SET team_id = s.keep_id
FROM strays s
WHERE sr.team_id = s.stray_id;

DELETE FROM engage_teams t
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_id, name
           ORDER BY score DESC, created_at ASC, id ASC
         ) AS rn
  FROM engage_teams
) r
WHERE t.id = r.id AND r.rn > 1;

-- One team name per session, from here on enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS engage_teams_session_name_key
  ON engage_teams(session_id, name);
