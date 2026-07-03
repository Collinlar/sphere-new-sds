'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { INSTITUTION_ONBOARDING_DEPOSIT_GHS } from '@/lib/institution-deposit'
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
          <div style={{ background: 'var(--teal-light)', borderRadius: 12, padding: '24px 20px' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal-dark)', marginBottom: 8 }}>Institution plan active</p>
            <p style={{ fontSize: 14, color: 'var(--teal-dark)', lineHeight: 1.6 }}>
              {institutionName} is on the Institution plan with unlimited creations, certificates, and marketplace access for up to 100 enrolled students.
            </p>
          </div>
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
              Institution pricing is based on enrolled students, modules, and support level. Tell us about your school or organisation and we will send a tailored quote in GHS.
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
              Base Institution plan includes 100 enrolled students, unlimited creations, certificates, and marketplace access. Per-head pricing applies beyond 100.
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
