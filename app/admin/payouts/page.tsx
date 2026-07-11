'use client'

import { useEffect, useState } from 'react'
import {
  adminGetPayoutRequests,
  adminGetCreatorEarnings,
  adminSetPayoutStatus,
  type AdminPayoutRequest,
  type AdminCreatorEarning,
} from '@/lib/admin'

type Tab = 'requests' | 'creators'

function ghs(n: number) { return `GH₵ ${n.toLocaleString()}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: 'Requested', color: '#9A5800', bg: '#FEF0DC' },
  paid: { label: 'Paid', color: '#1A8966', bg: '#DDFAF0' },
  rejected: { label: 'Rejected', color: '#C23B2A', bg: '#FDECEA' },
}

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<Tab>('requests')
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([])
  const [earnings, setEarnings] = useState<AdminCreatorEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  async function load() {
    const [reqs, earn] = await Promise.all([adminGetPayoutRequests(), adminGetCreatorEarnings()])
    setRequests(reqs)
    setEarnings(earn)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: 'paid' | 'rejected') {
    const res = await adminSetPayoutStatus(id, status)
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status, paidAt: status === 'paid' ? new Date().toISOString() : r.paidAt } : r))
      flash(status === 'paid' ? 'Marked as paid.' : 'Request rejected.')
    }
  }
  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const pending = requests.filter(r => r.status === 'requested')
  const totalRequested = pending.reduce((s, r) => s + r.amountGhs, 0)
  const totalOwed = earnings.reduce((s, e) => s + e.owedGhs, 0)

  return (
    <div className="r-pad" style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Creator payouts</p>
        </div>
        {msg && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', padding: '7px 14px', borderRadius: 20 }}>{msg}</p>}
      </div>

      {/* Summary */}
      <div className="r-collapse-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="sphere-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Pending requests</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--near-black)' }}>{pending.length}</p>
        </div>
        <div className="sphere-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Requested (to pay)</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#9A5800' }}>{ghs(totalRequested)}</p>
        </div>
        <div className="sphere-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Cleared &amp; owed (all creators)</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{ghs(totalOwed)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([{ key: 'requests', label: `Requests (${pending.length})` }, { key: 'creators', label: 'Creator earnings' }] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            height: 36, padding: '0 18px', borderRadius: 20, border: 'none',
            background: tab === t.key ? 'var(--near-black)' : 'var(--white)',
            color: tab === t.key ? '#fff' : 'var(--mid-grey)',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading payouts...</p>
      ) : tab === 'requests' ? (
        <div className="r-table-scroll" style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Creator', 'Amount', 'Destination', 'Requested', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => {
                const s = STATUS_META[r.status] ?? STATUS_META.requested
                return (
                  <tr key={r.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{r.creatorName}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.creatorEmail}</p>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: 'var(--near-black)', whiteSpace: 'nowrap' }}>{ghs(r.amountGhs)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--mid-grey)' }}>{r.destination ?? r.method ?? 'MoMo'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(r.requestedAt)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '3px 9px', borderRadius: 20 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.status === 'requested' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setStatus(r.id, 'paid')} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark paid</button>
                          <button onClick={() => setStatus(r.id, 'rejected')} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: 'var(--coral-light)', color: 'var(--coral)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.paidAt ? fmtDate(r.paidAt) : '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {requests.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No payout requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="r-table-scroll" style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Creator', 'Sales', 'Lifetime earnings', 'Cleared', 'Paid out', 'Owed now'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {earnings.map((e, i) => (
                <tr key={e.creatorId} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{e.creatorName}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.creatorEmail}</p>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--near-black)' }}>{e.sales}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{ghs(e.lifetimeEarningsGhs)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{ghs(e.clearedGhs)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{ghs(e.paidOutGhs)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: e.owedGhs > 0 ? 'var(--blue)' : 'var(--text-tertiary)' }}>{ghs(e.owedGhs)}</td>
                </tr>
              ))}
              {earnings.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No creator sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
