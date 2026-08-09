-- =====================================================================
-- engage_teams row level security.
--
-- THE BUG THIS FIXES
--   engage_teams had RLS enabled and no policy anywhere in the repo, so
--   every insert failed with 42501. ensureTeamsForSession swallowed that
--   error and returned an empty list, so no team was ever created, no
--   player was ever assigned one, and the play screen rendered nothing.
--   It looked like a UI bug. It was a permissions bug two layers down.
--
--   This affected every team-based mode, not only co-op. Co-op simply
--   made it visible because co-op cannot fall back to solo play.
--
--   20260711_enable_rls.sql enumerated the live-play tables by hand and
--   engage_teams was not on the list. That is the fixed-list fragility
--   flagged when that migration was written.
--
-- WHY THIS POLICY IS PERMISSIVE
--   Live games are played by guests with no JWT: a student joins with a
--   code and a display name, never an account. The same reasoning already
--   applies to session_participants and session_responses in tier 6 of the
--   RLS migration. Locking these properly needs signed per-session tokens,
--   which is an application change, not a policy change. Treat these
--   tables as open during a live game.
--
-- Safe to re-run.
-- =====================================================================

ALTER TABLE engage_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engage_teams_participate ON engage_teams;
CREATE POLICY engage_teams_participate ON engage_teams
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
