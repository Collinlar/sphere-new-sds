-- =====================================================================
-- AI credits.
--
-- Replaces flat monthly AI add-on subscriptions with prepaid credits, the
-- model this market already understands from airtime, data bundles, and
-- prepaid meters. It also stops fighting mobile money, which handles a
-- single successful payment far better than a recurring debit.
--
-- HYBRID DESIGN
--   Plans include a monthly credit allowance, and anyone can top up.
--   Allowance credits refresh each month and do NOT roll over.
--   Purchased credits never expire while the account is active.
--   Spending draws down the allowance first, so bought credits are the
--   last thing a creator loses.
--
-- OWNERSHIP
--   A credit account belongs to a user (personal work) or to an
--   institution (one pooled balance every teacher draws from). Mirrors
--   the owner_id/owner_type pattern already used by certificate_templates.
--
-- Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_credit_accounts (
  owner_type TEXT NOT NULL,                       -- 'user' | 'institution'
  owner_id UUID NOT NULL,
  -- Refreshes monthly from the plan. Never rolls over.
  allowance_balance INT NOT NULL DEFAULT 0,
  allowance_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Bought or granted. Does not expire while the account is active.
  purchased_balance INT NOT NULL DEFAULT 0,
  lifetime_purchased INT NOT NULL DEFAULT 0,
  lifetime_granted INT NOT NULL DEFAULT 0,
  lifetime_used INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (owner_type, owner_id)
);

-- Full audit trail. Every movement is recorded so a creator can always be
-- shown where their credits went, and so refunds are defensible.
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  delta INT NOT NULL,                             -- negative for spend
  kind TEXT NOT NULL,                             -- 'signup_grant'|'allowance'|'purchase'|'spend'|'refund'|'admin_grant'
  reason TEXT,
  task TEXT,                                      -- which generator spent it
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  balance_after INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_owner
  ON ai_credit_transactions(owner_type, owner_id, created_at DESC);

ALTER TABLE ai_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Creators read their own balance; institution members read the pooled one.
-- All writes happen server-side with the service role, which bypasses RLS.
DROP POLICY IF EXISTS ai_credit_accounts_read ON ai_credit_accounts;
CREATE POLICY ai_credit_accounts_read ON ai_credit_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR (owner_type = 'user' AND owner_id = auth.uid())
    OR (owner_type = 'institution' AND public.in_institution(owner_id))
  );

DROP POLICY IF EXISTS ai_credit_tx_read ON ai_credit_transactions;
CREATE POLICY ai_credit_tx_read ON ai_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR (owner_type = 'user' AND owner_id = auth.uid())
    OR (owner_type = 'institution' AND public.manages_institution(owner_id))
  );

-- ---------------------------------------------------------------------
-- Defaults, all tunable from Platform config without a deploy.
--   1 credit = 1 generated item (one question, one module, one step).
--   Flat rate on purpose: a course module costs more to produce than an
--   MCQ, but even the dearest item stays profitable, and "one credit per
--   question" is a rule a teacher understands immediately.
-- ---------------------------------------------------------------------
INSERT INTO platform_settings (key, value) VALUES
  ('ai_credit_signup_grant',        '30'),   -- one-time, enough for a full first exam
  ('ai_credits_membership',         '0'),    -- free plan tops up instead
  ('ai_credits_creator_quarterly',  '100'),
  ('ai_credits_creator_marketplace','100'),
  ('ai_credits_institution',        '500'),  -- pooled across the institution
  ('ai_credit_cost_per_item',       '1')
ON CONFLICT (key) DO NOTHING;
