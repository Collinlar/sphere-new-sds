'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface VerifiedCertificate {
  verification_code: string
  resource_type: string
  resource_title: string
  issued_at: string
  users?: { name: string }
}

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [cert, setCert] = useState<VerifiedCertificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const normalized = decodeURIComponent(code).toUpperCase()
      const { data } = await supabase
        .from('issued_certificates')
        .select('verification_code, resource_type, resource_title, issued_at, users(name)')
        .eq('verification_code', normalized)
        .maybeSingle()

      if (!data) {
        setNotFound(true)
      } else {
        const row = data as Record<string, unknown>
        const usersRaw = row.users
        const userName = Array.isArray(usersRaw)
          ? (usersRaw[0] as { name?: string } | undefined)?.name
          : (usersRaw as { name?: string } | null)?.name
        setCert({
          verification_code: row.verification_code as string,
          resource_type: row.resource_type as string,
          resource_title: row.resource_title as string,
          issued_at: row.issued_at as string,
          users: userName ? { name: userName } : undefined,
        })
      }
      setLoading(false)
    }
    load()
  }, [code])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: 'var(--font)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
          Sphere
        </Link>

        <div style={{ background: 'var(--white)', borderRadius: 14, padding: '28px 24px', boxShadow: 'var(--shadow-soft)', marginTop: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Certificate verification
          </p>

          {loading && <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Checking verification code...</p>}

          {!loading && notFound && (
            <>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>Code not found</p>
              <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.6 }}>
                We could not find a certificate with code <strong>{decodeURIComponent(code).toUpperCase()}</strong>. Check the code and try again.
              </p>
            </>
          )}

          {!loading && cert && (
            <>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', marginBottom: 16 }}>Verified certificate</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 2 }}>Recipient</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{cert.users?.name ?? 'Verified recipient'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 2 }}>Resource</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>{cert.resource_title}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 2 }}>Type</p>
                  <p style={{ fontSize: 14, color: 'var(--near-black)', textTransform: 'capitalize' }}>{cert.resource_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 2 }}>Issued</p>
                  <p style={{ fontSize: 14, color: 'var(--near-black)' }}>
                    {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Verification code
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '0.06em' }}>{cert.verification_code}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
