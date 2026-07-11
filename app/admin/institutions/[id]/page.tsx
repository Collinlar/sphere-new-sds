'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getEnrollmentBilling,
  markOverageBilled,
  type EnrollmentBilling,
} from '@/lib/enrollment-billing'
import { getCurrentUser } from '@/lib/auth'
import AcademicSetupCard from '@/components/brand/AcademicSetupCard'
import { getInstitutionVerification, adminSetInstitutionVerification, type VerificationStatus } from '@/lib/institution-verification'
import { listInstitutionInvoices, createInvoice, markInvoicePaid, type Invoice } from '@/lib/invoices'
import type { MemberRole } from '@/lib/context'

interface Institution {
  id: string
  name: string
  city?: string
  subscription_plan?: string
  modules?: string[]
  institution_type_id?: string
  created_at: string
  institution_types?: { name: string }
}

interface User {
  id: string
  name: string
  email: string
  role: string
  subscription_tier?: string
  created_at: string
}

interface Member {
  id: string
  userId: string | null
  name: string
  email: string
  role: MemberRole
  status: string
  invitedEmail: string | null
  claimCode: string | null
  joinedAt: string | null
  createdAt: string
}

const ALL_MODULES = ['assess', 'engage', 'learn', 'train']
const TIERS = ['membership', 'creator_quarterly', 'creator_marketplace', 'institution']

export default function InstitutionDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const router = useRouter()
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [memberMsg, setMemberMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [billing, setBilling] = useState<EnrollmentBilling | null>(null)
  const [billingMsg, setBillingMsg] = useState('')
  const [billingBusy, setBillingBusy] = useState(false)
  const [verif, setVerif] = useState<VerificationStatus>('unverified')
  const [billInvoices, setBillInvoices] = useState<Invoice[]>([])
  const [invDesc, setInvDesc] = useState('')
  const [invAmount, setInvAmount] = useState('')
  const [invBusy, setInvBusy] = useState(false)

  // Edit state
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [plan, setPlan] = useState('institution')

  useEffect(() => {
    async function load() {
      const { data: inst } = await supabase
        .from('institutions')
        .select('*, institution_types(name)')
        .eq('id', id)
        .single()

      if (!inst) { setLoading(false); return }
      const parsedModules = Array.isArray(inst.modules)
        ? inst.modules
        : typeof inst.modules === 'string'
          ? JSON.parse(inst.modules)
          : []

      setInstitution(inst as Institution)
      setName(inst.name)
      setCity(inst.city ?? '')
      setModules(parsedModules)
      setPlan(inst.subscription_plan ?? 'institution')
      setVerif((inst.verification_status as VerificationStatus) ?? 'unverified')
      listInstitutionInvoices(id).then(setBillInvoices)

      const { data: userRows } = await supabase
        .from('users')
        .select('id, name, email, role, subscription_tier, created_at')
        .eq('institution_id', id)
        .order('created_at', { ascending: false })

      setUsers((userRows ?? []) as User[])

      const { data: memberRows } = await supabase
        .from('institution_members')
        .select('id, user_id, member_role, status, invited_email, claim_code, joined_at, created_at, users(name, email)')
        .eq('institution_id', id)
        .neq('status', 'removed')
        .order('created_at', { ascending: false })

      setMembers((memberRows ?? []).map(m => {
        const u = (m as unknown as { users?: { name: string; email: string } }).users
        return {
          id: m.id as string,
          userId: (m.user_id as string) ?? null,
          name: u?.name ?? (m.invited_email as string) ?? 'Invited member',
          email: u?.email ?? (m.invited_email as string) ?? '',
          role: m.member_role as MemberRole,
          status: m.status as string,
          invitedEmail: (m.invited_email as string) ?? null,
          claimCode: (m.claim_code as string) ?? null,
          joinedAt: (m.joined_at as string) ?? null,
          createdAt: m.created_at as string,
        }
      }))

      getEnrollmentBilling(id).then(setBilling)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleMarkBilled() {
    if (!billing) return
    setBillingBusy(true)
    const result = await markOverageBilled(id, getCurrentUser().id, billing)
    setBillingBusy(false)
    if (!result.ok) { setBillingMsg(result.error); setTimeout(() => setBillingMsg(''), 4000); return }
    setBillingMsg('Invoice recorded for this quarter.')
    setTimeout(() => setBillingMsg(''), 3000)
    listInstitutionInvoices(id).then(setBillInvoices)
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this institution?`)) return
    await supabase.from('institution_members').update({ status: 'removed', removed_at: new Date().toISOString() }).eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setMemberMsg('Member removed.')
    setTimeout(() => setMemberMsg(''), 3000)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('institutions').update({
      name,
      city: city || null,
      modules,
      subscription_plan: plan,
    }).eq('id', id)

    // Lift free-tier admins to match the institution plan, but never clobber
    // a paid personal plan (e.g. a Creator who also runs this institution).
    await supabase
      .from('users')
      .update({ subscription_tier: plan })
      .eq('institution_id', id)
      .eq('role', 'admin')
      .eq('subscription_tier', 'membership')

    setSaving(false)
    setMsg('Saved.')
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleDelete() {
    if (confirmDelete !== institution?.name) return
    setDeleting(true)
    await supabase.from('institutions').delete().eq('id', id)
    router.push('/admin/institutions')
  }

  function toggleModule(mod: string) {
    setModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])
  }

  if (loading) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p></div>
  if (!institution) return <div style={{ padding: 32 }}><p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Institution not found.</p></div>

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 860 }}>
      {/* Back */}
      <Link href="/admin/institutions" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 20 }}>
        ← All institutions
      </Link>

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>{institution.name}</p>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
          {(institution as { institution_types?: { name: string } }).institution_types?.name ?? 'Unknown type'} · {institution.city ?? 'No city'} · Created {new Date(institution.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="r-collapse-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Edit form */}
        <div style={{ background: 'var(--white)', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-soft)', gridColumn: '1 / -1' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 16 }}>Institution settings</p>

          <div className="r-collapse-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', height: 38, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', height: 38, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Active modules</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ALL_MODULES.map(mod => {
                const on = modules.includes(mod)
                return (
                  <button key={mod} onClick={() => toggleModule(mod)} style={{
                    height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
                    background: on ? 'var(--near-black)' : 'var(--bg2)',
                    color: on ? '#fff' : 'var(--mid-grey)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    textTransform: 'capitalize',
                  }}>{mod}</button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Subscription plan</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIERS.map(t => (
                <button key={t} onClick={() => setPlan(t)} style={{
                  height: 32, padding: '0 14px', borderRadius: 20, border: 'none',
                  background: plan === t ? 'var(--amber)' : 'var(--bg2)',
                  color: plan === t ? '#fff' : 'var(--mid-grey)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleSave} disabled={saving} style={{
              height: 36, padding: '0 20px', borderRadius: 8, border: 'none',
              background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>{saving ? 'Saving...' : 'Save changes'}</button>
            {msg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{msg}</p>}
          </div>
        </div>
      </div>

      {/* Verification — gates branded certificates and public presence. */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Verification</p>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: verif === 'verified' ? 'var(--teal)' : verif === 'pending' ? '#9A5800' : verif === 'rejected' ? 'var(--coral)' : 'var(--mid-grey)', background: verif === 'verified' ? 'var(--teal-light)' : verif === 'pending' ? 'var(--amber-light)' : verif === 'rejected' ? '#FDECEA' : 'var(--bg2)', padding: '2px 9px', borderRadius: 20 }}>{verif}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 4 }}>Verified institutions can issue branded certificates and appear as trusted.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {verif !== 'verified' && (
              <button onClick={async () => { const r = await adminSetInstitutionVerification(id, 'verified'); if (r.ok) setVerif('verified') }} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Verify</button>
            )}
            {verif !== 'rejected' && verif !== 'unverified' && (
              <button onClick={async () => { const r = await adminSetInstitutionVerification(id, 'rejected'); if (r.ok) setVerif('rejected') }} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--coral)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
            )}
            {verif === 'verified' && (
              <button onClick={async () => { const r = await adminSetInstitutionVerification(id, 'unverified'); if (r.ok) setVerif('unverified') }} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--white)', color: 'var(--mid-grey)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Revoke</button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices — raise an arrangement/manual invoice, mark paid, receipt. */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: '18px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>Invoices</p>
        {billInvoices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
            {billInvoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>GH₵ {inv.amountGhs.toLocaleString('en-GB')}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: inv.status === 'paid' ? 'var(--teal)' : '#9A5800' }}>{inv.status}</span>
                {inv.status !== 'paid' && inv.status !== 'void' && (
                  <button onClick={async () => { const r = await markInvoicePaid(inv.id); if (r.ok) setBillInvoices(prev => prev.map(x => x.id === inv.id ? { ...x, status: 'paid', paidAt: new Date().toISOString() } : x)) }} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark paid</button>
                )}
                <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', textDecoration: 'none' }}>View</a>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: billInvoices.length > 0 ? 12 : 0, borderTop: billInvoices.length > 0 ? '0.5px solid var(--border)' : 'none' }}>
          <input value={invDesc} onChange={e => setInvDesc(e.target.value)} placeholder="What is this invoice for?" style={{ flex: 1, minWidth: 200, height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          <input value={invAmount} onChange={e => setInvAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="GHS" style={{ width: 90, height: 34, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          <button
            onClick={async () => {
              const amount = Number(invAmount)
              if (!invDesc.trim() || !Number.isFinite(amount) || amount <= 0) return
              setInvBusy(true)
              const res = await createInvoice({ institutionId: id, invoiceType: 'manual', description: invDesc, amountGhs: amount, issuedBy: getCurrentUser().id })
              setInvBusy(false)
              if (res.ok) { setInvDesc(''); setInvAmount(''); listInstitutionInvoices(id).then(setBillInvoices) }
            }}
            disabled={invBusy || !invDesc.trim() || !invAmount}
            style={{ height: 34, padding: '0 16px', borderRadius: 7, border: 'none', background: 'var(--near-black)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: invBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}
          >Raise invoice</button>
        </div>
      </div>

      {/* Academic setup: calendar, custom levels, extra level groups —
          the same controls the institution owner has, so support can set
          them up on the customer's behalf. */}
      <AcademicSetupCard institutionId={id} />

      {/* Enrolled student metering / per-head overage */}
      {billing?.metered && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: '18px 20px', marginBottom: 24, border: billing.overage > 0 ? '1px solid #E8A020' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Enrolled students</p>
            {billingMsg && <p style={{ fontSize: 12, color: billingMsg.includes('recorded') ? 'var(--teal)' : 'var(--coral)' }}>{billingMsg}</p>}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: billing.overage > 0 ? 16 : 0 }}>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--near-black)', lineHeight: 1 }}>{billing.current}</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Enrolled ({billing.cap} included)</p>
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: billing.overage > 0 ? '#D97010' : 'var(--near-black)', lineHeight: 1 }}>{billing.overage}</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Above cap</p>
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: billing.overagePeriodGhs > 0 ? '#1A8966' : 'var(--near-black)', lineHeight: 1 }}>GHS {billing.overagePeriodGhs.toLocaleString()}</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Per-head / quarter (at GHS {billing.perHeadGhs})</p>
            </div>
          </div>

          {billing.overage > 0 && (
            <button
              onClick={handleMarkBilled}
              disabled={billingBusy}
              style={{ height: 34, padding: '0 16px', borderRadius: 7, border: 'none', background: '#E8A020', color: '#fff', fontSize: 12, fontWeight: 600, cursor: billingBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              {billingBusy ? 'Recording...' : 'Mark this quarter billed'}
            </button>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5 }}>
            Billing this quarter adds an overage invoice to the Invoices list.
          </p>
        </div>
      )}

      {/* Members table (institution_members — roles, invites, claim codes) */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>Members ({members.length})</p>
          {memberMsg && <p style={{ fontSize: 12, color: 'var(--teal)' }}>{memberMsg}</p>}
        </div>
        {members.length > 0 ? (
          <div className="r-table-scroll">
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Name', 'Email', 'Role', 'Status', 'Claim code', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      {m.userId ? (
                        <Link href={`/admin/users/${m.userId}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', textDecoration: 'none' }}>{m.name}</Link>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)' }}>{m.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{m.email}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m.role}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                        color: m.status === 'active' ? '#1A8966' : '#9A5800',
                        background: m.status === 'active' ? '#DDFAF0' : '#FEF0DC',
                      }}>{m.status === 'active' ? 'Active' : 'Invited'}</span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{m.claimCode ?? '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {m.role !== 'owner' && (
                        <button onClick={() => removeMember(m.id, m.name)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--coral)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p style={{ padding: '12px 20px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              No membership records yet — showing legacy users linked directly to this institution.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Name', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <Link href={`/admin/users/${u.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', textDecoration: 'none' }}>{u.name}</Link>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{u.email}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{u.role}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Danger zone */}
      <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', padding: '20px', border: '0.5px solid var(--coral-light)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--coral)', marginBottom: 10 }}>Danger zone</p>
        <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 12, lineHeight: 1.6 }}>
          Deleting this institution removes all associated data. Type the institution name to confirm.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            placeholder={institution.name}
            value={confirmDelete}
            onChange={e => setConfirmDelete(e.target.value)}
            style={{ flex: 1, height: 36, border: '0.5px solid var(--border)', borderRadius: 7, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleDelete}
            disabled={confirmDelete !== institution.name || deleting}
            style={{
              height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
              background: confirmDelete === institution.name ? 'var(--coral)' : 'var(--bg2)',
              color: confirmDelete === institution.name ? '#fff' : 'var(--text-tertiary)',
              fontSize: 13, fontWeight: 600, cursor: confirmDelete === institution.name ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete institution'}
          </button>
        </div>
      </div>
    </div>
  )
}
