'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { INSTITUTION_ONBOARDING_DEPOSIT_GHS } from '@/lib/institution-deposit'
import { getEnrollmentBilling, type EnrollmentBilling } from '@/lib/enrollment-billing'
import { listInstitutionInvoices, type Invoice } from '@/lib/invoices'
import { startCheckout, verifyCheckoutReference } from '@/lib/checkout-client'

function InstitutionInquiryInner() {
  const searchParams = useSearchParams()
  const user = getCurrentUser()
  const [institutionName, setInstitutionName] = useState('')
  const [institutionPlan, setInstitutionPlan] = useState<string | null>(null)
  const [depositPaidAt, setDepositPaidAt] = useState<string | null>(null)
  const [contactName, setContactName] = useState(user.name ?? '')
  const [contactEmail, setContactEmail] = useState(user.email ?? '')
  const [contactPhone, setContactPhone] = useState('')
  const [studentCount, setStudentCount] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutMsg, setCheckoutMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [inquiryId, setInquiryId] = useState<string | null>(null)
  const [billing, setBilling] = useState<EnrollmentBilling | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const isAdmin = user.role === 'admin'
  const depositAmount = INSTITUTION_ONBOARDING_DEPOSIT_GHS
  const institutionActive = institutionPlan === 'institution' || Boolean(depositPaidAt)

  useEffect(() => {
    if (!user.institution_id) return
    supabase
      .from('institutions')
      .select('name, subscription_plan, onboarding_deposit_paid_at')
      .eq('id', user.institution_id)
      .single()
      .then(({ data }) => {
        if (data?.name) setInstitutionName(data.name)
        setInstitutionPlan(data?.subscription_plan ?? null)
        setDepositPaidAt(data?.onboarding_deposit_paid_at ?? null)
      })
    getEnrollmentBilling(user.institution_id).then(setBilling)
    listInstitutionInvoices(user.institution_id).then(setInvoices)
  }, [user.institution_id])

  useEffect(() => {
    const reference = searchParams.get('reference')
    if (!reference) return

    verifyCheckoutReference(reference).then((result) => {
      if (result.ok) {
        setCheckoutMsg('Deposit confirmed. Your institution plan is now active.')
        setInstitutionPlan('institution')
        setDepositPaidAt(new Date().toISOString())
        window.history.replaceState({}, '', '/platform/settings/billing/institution')
      } else {
        setCheckoutError(result.error)
      }
    })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/institution-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionName,
        contactName,
        contactEmail,
        contactPhone,
        studentCount: studentCount ? parseInt(studentCount, 10) : undefined,
        message,
      }),
    })

    const body = await res.json().catch(() => null)
    setSubmitting(false)

    if (!res.ok) {
      setError(body?.error ?? 'Your enquiry did not go through. Try again.')
      return
    }

    setInquiryId(body.id as string)
    setSent(true)
  }

  async function handleDeposit() {
    if (!user.institution_id) {
      setCheckoutError('Your account is not linked to an institution yet.')
      return
    }

    setCheckingOut(true)
    setCheckoutError('')

    const result = await startCheckout({
      intentType: 'institution_deposit',
      payload: {
        institutionId: user.institution_id,
        inquiryId: inquiryId ?? undefined,
      },
      callbackPath: '/platform/settings/billing/institution',
    })

    setCheckingOut(false)
    if (!result.ok) {
      setCheckoutError(result.error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Institution plan"
        left={
          <Link href="/platform/settings/billing" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Plan and billing
          </Link>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 560 }}>
        {checkoutMsg && (
          <div style={{ background: 'var(--teal-light)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal-dark)' }}>{checkoutMsg}</p>
          </div>
        )}

        {institutionActive ? (
          <>
            <div style={{ background: 'var(--teal-light)', borderRadius: 12, padding: '24px 20px', marginBottom: 16 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal-dark)', marginBottom: 8 }}>Institution plan active</p>
              <p style={{ fontSize: 14, color: 'var(--teal-dark)', lineHeight: 1.6 }}>
                {institutionName} is on the Institution plan with unlimited creations, certificates, and marketplace access for up to {billing?.cap ?? 100} enrolled students.
              </p>
            </div>

            {invoices.length > 0 && (
              <div className="sphere-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Invoices and receipts</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {invoices.map((inv, i) => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{inv.period ? ` · ${inv.period}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', whiteSpace: 'nowrap' }}>GH₵ {inv.amountGhs.toLocaleString('en-GB')}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: inv.status === 'paid' ? 'var(--teal)' : inv.status === 'void' ? 'var(--text-tertiary)' : '#9A5800', background: inv.status === 'paid' ? 'var(--teal-light)' : inv.status === 'void' ? 'var(--bg2)' : 'var(--amber-light)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{inv.status}</span>
                      <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', textDecoration: 'none', flexShrink: 0 }}>{inv.status === 'paid' ? 'Receipt' : 'View'}</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {billing?.metered && (
              <div className="sphere-card" style={{ padding: '18px 20px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                  Enrolled students this cycle
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--near-black)', lineHeight: 1 }}>{billing.current}</span>
                  <span style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 2 }}>enrolled · {billing.cap} included</span>
                </div>
                {(() => {
                  const pct = billing.cap ? Math.min((billing.current / billing.cap) * 100, 100) : 0
                  const over = billing.overage > 0
                  return (
                    <>
                      <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: over ? '#D97010' : '#1A8966', borderRadius: 4 }} />
                      </div>
                      {over ? (
                        <div style={{ background: '#FEF0DC', border: '1px solid #E8A020', borderRadius: 8, padding: '12px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#9A5800', marginBottom: 3 }}>
                            {billing.overage} student{billing.overage === 1 ? '' : 's'} above your included {billing.cap}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
                            Per-head pricing applies: {billing.overage} × GHS {billing.perHeadGhs} = <strong>GHS {billing.overagePeriodGhs.toLocaleString()} per quarter</strong>. Sphere will include this in your next invoice.
                          </p>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
                          {billing.cap && billing.current < billing.cap
                            ? `${billing.cap - billing.current} more within your included allowance. Beyond ${billing.cap}, students are GHS ${billing.perHeadGhs} each per quarter.`
                            : `You are at your included allowance. Additional students are GHS ${billing.perHeadGhs} each per quarter.`}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        ) : sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--teal-light)', borderRadius: 12, padding: '24px 20px' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal-dark)', marginBottom: 8 }}>Enquiry received</p>
              <p style={{ fontSize: 14, color: 'var(--teal-dark)', lineHeight: 1.6 }}>
                Sphere will review your institution details and send a custom quote within 2 business days. Check {contactEmail} for a reply.
              </p>
            </div>
            {isAdmin && <DepositCard amount={depositAmount} checkingOut={checkingOut} error={checkoutError} onPay={handleDeposit} />}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.65, marginBottom: 24 }}>
              Institution plan is GHS 1,000 per quarter. That covers unlimited creations, certificates, and marketplace access for up to 100 enrolled students. Per-head pricing applies beyond 100. Tell us about your school or organisation and we will confirm your setup.
            </p>

            {isAdmin && (
              <div style={{ marginBottom: 20 }}>
                <DepositCard amount={depositAmount} checkingOut={checkingOut} error={checkoutError} onPay={handleDeposit} />
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.6 }}>
                  Prefer a quote first? Send the enquiry below and pay the deposit when you are ready.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="sphere-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Institution name" value={institutionName} onChange={setInstitutionName} required />
              <Field label="Your name" value={contactName} onChange={setContactName} required />
              <Field label="Email" value={contactEmail} onChange={setContactEmail} required type="email" />
              <Field label="WhatsApp or phone" value={contactPhone} onChange={setContactPhone} placeholder="024 XXX XXXX" />
              <Field label="Enrolled students (approx.)" value={studentCount} onChange={setStudentCount} type="number" placeholder="100" />
              <div>
                <label style={labelStyle}>What do you need?</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Modules, certificates, enrolled student count, timeline..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
                />
              </div>

              {error && <p style={{ fontSize: 13, color: 'var(--coral)' }}>{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: 48,
                  borderRadius: 10,
                  border: 'none',
                  background: '#1A8966',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: submitting ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? 'Sending enquiry...' : 'Send my institution enquiry'}
              </button>
            </form>

            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 20, lineHeight: 1.6 }}>
              GHS 1,000 per quarter. Includes 100 enrolled students, unlimited creations, certificates, and marketplace access. Per-head pricing applies beyond 100.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function DepositCard({
  amount,
  checkingOut,
  error,
  onPay,
}: {
  amount: number
  checkingOut: boolean
  error: string
  onPay: () => void
}) {
  return (
    <div className="sphere-card" style={{ padding: '18px 18px 16px' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--near-black)', marginBottom: 6 }}>Pay onboarding deposit</p>
      <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 14 }}>
        GHS {amount.toLocaleString()} secures your Institution plan setup. Pay with MTN MoMo, Telecel Cash, or card via Paystack. Your quote can still be adjusted for student count above 100.
      </p>
      {error && <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 10 }}>{error}</p>}
      <button
        type="button"
        onClick={onPay}
        disabled={checkingOut}
        style={{
          height: 44,
          width: '100%',
          borderRadius: 10,
          border: 'none',
          background: '#1A8966',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: checkingOut ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {checkingOut ? 'Opening Paystack...' : `Pay GHS ${amount.toLocaleString()} onboarding deposit`}
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--mid-grey)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg2)',
  borderRadius: 8,
  padding: '0 14px',
  border: '1px solid transparent',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

export default function InstitutionInquiryPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <InstitutionInquiryInner />
    </Suspense>
  )
}
