-- =====================================================================
-- Team scoring parity.
--
-- Solo play now earns speed, streak and comeback weighting. Team play was
-- left on flat points, which made the two modes feel like different games.
--
-- One deliberate difference remains: teams do NOT earn a speed bonus.
-- Team mode exists so a group argues its way to an answer, and paying for
-- speed would punish exactly the discussion the mode is for. Teams earn on
-- accuracy, consensus, consistency, and staying in the game.
--
-- Safe to re-run.
-- =====================================================================

ALTER TABLE engage_teams
  ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0;
