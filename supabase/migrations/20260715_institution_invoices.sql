-- =====================================================================
-- Institution invoices. A single record for every institution charge:
-- deposit, quarterly renewal, per-head overage, add-ons, or a manual
-- "arrangement" invoice raised by staff. On payment it becomes the
-- receipt. On-screen / printable for v1 (PDF generation can layer on).
-- Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS institution_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL DEFAULT 'manual',   -- 'deposit' | 'quarterly' | 'overage' | 'addon' | 'manual'
  description TEXT NOT NULL,
  amount_ghs NUMERIC(10,2) NOT NULL DEFAULT 0,
  period TEXT,                                    -- e.g. '2026-Q3'
  status TEXT NOT NULL DEFAULT 'sent',            -- 'draft' | 'sent' | 'paid' | 'void'
  reference TEXT,                                 -- payment reference when paid
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_invoices_inst ON institution_invoices(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_invoices_status ON institution_invoices(status);

ALTER TABLE institution_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institution_invoices_rw ON institution_invoices;
CREATE POLICY institution_invoices_rw ON institution_invoices
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id) OR public.is_staff())
  WITH CHECK (public.manages_institution(institution_id) OR public.is_staff());
