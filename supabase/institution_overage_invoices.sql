-- =====================================================
-- Per-head overage invoices for Institution-plan institutions
-- above their included enrolled-student cap. Run after
-- enrollment billing is in place (lib/enrollment-billing.ts).
-- =====================================================

CREATE TABLE IF NOT EXISTS institution_overage_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  period TEXT NOT NULL,               -- e.g. '2026-07'
  overage_count INT NOT NULL,
  per_head_ghs NUMERIC(10,2) NOT NULL,
  amount_ghs NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'billed',  -- 'billed' | 'paid'
  billed_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  billed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (institution_id, period)
);

CREATE INDEX IF NOT EXISTS idx_overage_invoices_institution ON institution_overage_invoices(institution_id);
CREATE INDEX IF NOT EXISTS idx_overage_invoices_status ON institution_overage_invoices(status);

ALTER TABLE institution_overage_invoices DISABLE ROW LEVEL SECURITY;
