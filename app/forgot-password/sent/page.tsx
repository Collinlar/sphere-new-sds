'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { IconInfo, IconMail } from '@/components/icons'

function SentContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? 'your email'
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleResend() {
    if (!email || email === 'your email') return
    setResending(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResending(false)
    setResent(true)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#D5D4D1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--page-bg)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card)',
        padding: '52px 32px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--teal-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          color: 'var(--teal)',
        }}>
          <IconMail size={30} />
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Check your inbox
        </p>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 6 }}>
          We sent a reset link to
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 24 }}>
          {email}
        </p>

        <div style={{
          background: 'var(--amber-light)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          width: '100%',
        }}>
          <span style={{ color: 'var(--amber)', flexShrink: 0 }}>
            <IconInfo size={16} />
          </span>
          <p style={{ fontSize: 13, color: '#9A5800', lineHeight: 1.45 }}>
            Link expires in 15 minutes. Check your spam folder if you do not see it.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          style={{
            width: '100%',
            height: 48,
            background: 'var(--bg2)',
            borderRadius: 10,
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            color: resent ? 'var(--teal)' : 'var(--mid-grey)',
            cursor: resending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        >
          {resending ? 'Sending again...' : resent ? 'Email sent again' : 'Resend email'}
        </button>

        <Link href="/login" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordSentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#D5D4D1' }} />}>
      <SentContent />
    </Suspense>
  )
}
