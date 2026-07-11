import { supabase } from './supabase'

// Institution invoices + receipts. One record per charge; on payment it
// becomes the receipt. See supabase/migrations/20260715_institution_invoices.sql.

export type InvoiceType = 'deposit' | 'quarterly' | 'overage' | 'addon' | 'manual'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

export interface Invoice {
  id: string
  institutionId: string
  invoiceType: InvoiceType
  description: string
  amountGhs: number
  period: string | null
  status: InvoiceStatus
  reference: string | null
  dueAt: string | null
  paidAt: string | null
  createdAt: string
}

function mapRow(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as string,
    institutionId: r.institution_id as string,
    invoiceType: (r.invoice_type as InvoiceType) ?? 'manual',
    description: (r.description as string) ?? '',
    amountGhs: r.amount_ghs != null ? Number(r.amount_ghs) : 0,
    period: (r.period as string) ?? null,
    status: (r.status as InvoiceStatus) ?? 'sent',
    reference: (r.reference as string) ?? null,
    dueAt: (r.due_at as string) ?? null,
    paidAt: (r.paid_at as string) ?? null,
    createdAt: r.created_at as string,
  }
}

export async function listInstitutionInvoices(institutionId: string): Promise<Invoice[]> {
  const { data } = await supabase
    .from('institution_invoices')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(mapRow)
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data } = await supabase.from('institution_invoices').select('*').eq('id', id).maybeSingle()
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function createInvoice(input: {
  institutionId: string
  invoiceType: InvoiceType
  description: string
  amountGhs: number
  period?: string | null
  status?: InvoiceStatus
  issuedBy?: string | null
  dueAt?: string | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!input.description.trim()) return { ok: false, error: 'Add a description first.' }
  const { data, error } = await supabase
    .from('institution_invoices')
    .insert({
      institution_id: input.institutionId,
      invoice_type: input.invoiceType,
      description: input.description.trim(),
      amount_ghs: input.amountGhs,
      period: input.period ?? null,
      status: input.status ?? 'sent',
      issued_by: input.issuedBy ?? null,
      due_at: input.dueAt ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: 'That invoice did not save. Try again.' }
  return { ok: true, id: data.id as string }
}

export async function markInvoicePaid(id: string, reference?: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('institution_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), reference: reference ?? null })
    .eq('id', id)
  return { ok: !error }
}

export async function voidInvoice(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('institution_invoices').update({ status: 'void' }).eq('id', id)
  return { ok: !error }
}
