'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { getInvoice, type Invoice } from '@/lib/invoices'

export default function InvoicePage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const inv = await getInvoice(id)
      if (inv) {
        setInvoice(inv)
        const { data } = await supabase.from('institutions').select('name').eq('id', inv.institutionId).maybeSingle()
        setInstitutionName(data?.name ?? '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 40, fontFamily: 'var(--font)', color: 'var(--mid-grey)' }}>Loading...</div>
  if (!invoice) return <div style={{ padding: 40, fontFamily: 'var(--font)' }}>This invoice could not be found.</div>

  const paid = invoice.status === 'paid'
  const money = (n: number) => `GH₵ ${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F1', fontFamily: 'var(--font)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => window.print()} style={{ height: 40, padding: '0 20px', borderRadius: 9, border: 'none', background: 'var(--near-black, #18171A)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Print or save as PDF
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '40px 44px', boxShadow: '0 2px 18px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#18171A', letterSpacing: '-0.02em' }}>Sphere<span style={{ color: '#D97010' }}>SDS</span></p>
              <p style={{ fontSize: 12, color: '#6B6870', marginTop: 2 }}>Accra, Ghana</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: paid ? '#1A8966' : '#18171A', letterSpacing: '-0.02em' }}>{paid ? 'Receipt' : 'Invoice'}</p>
              <p style={{ fontSize: 11, color: '#A09DA8', fontFamily: 'monospace', marginTop: 2 }}>{invoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09DA8', marginBottom: 4 }}>Billed to</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#18171A' }}>{institutionName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: '#6B6870' }}>Issued {new Date(invoice.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {invoice.period && <p style={{ fontSize: 12, color: '#6B6870' }}>Period {invoice.period}</p>}
              {paid && invoice.paidAt && <p style={{ fontSize: 12, color: '#1A8966', fontWeight: 600 }}>Paid {new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EDECE9' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09DA8' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09DA8' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F5F4F1' }}>
                <td style={{ padding: '14px 0', fontSize: 14, color: '#18171A' }}>{invoice.description}</td>
                <td style={{ padding: '14px 0', fontSize: 14, color: '#18171A', textAlign: 'right', fontWeight: 600 }}>{money(invoice.amountGhs)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid #18171A' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#18171A' }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#18171A' }}>{money(invoice.amountGhs)}</span>
              </div>
            </div>
          </div>

          {invoice.reference && (
            <p style={{ fontSize: 11, color: '#A09DA8', marginTop: 24 }}>Payment reference: {invoice.reference}</p>
          )}
          <p style={{ fontSize: 11, color: '#A09DA8', marginTop: 8 }}>Paid via MTN MoMo, Telecel Cash, or bank transfer through Paystack.</p>
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
    </div>
  )
}
