'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'

interface VerifiedCertificate {
  verification_code: string
  resource_type: string
  resource_type_label: string
  resource_title: string
  issued_at: string
  recipient_name: string
  issuer_name: string
  achievement_summary: string | null
  score_percentage: number | null
  grade: string | null
  pass_mark: number | null
}

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [cert, setCert] = useState<VerifiedCertificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!cert) return
    const url = `${window.location.origin}/verify/${cert.verification_code}`
    QRCode.toDataURL(url, { width: 160, margin: 1, color: { dark: '#18171A', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [cert])

  useEffect(() => {
    async function load() {
      const normalized = decodeURIComponent(code).toUpperCase()
      try {
        const res = await fetch(`/api/verify/${encodeURIComponent(normalized)}`)
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setLookupFailed(true)
          return
        }
        const data = (await res.json()) as VerifiedCertificate
        setCert({
          verification_code: data.verification_code,
          resource_type: data.resource_type,
          resource_type_label: data.resource_type_label || data.resource_type,
          resource_title: data.resource_title,
          issued_at: data.issued_at,
          recipient_name: data.recipient_name || 'Verified recipient',
          issuer_name: data.issuer_name || 'Sphere educator',
          achievement_summary: data.achievement_summary ?? null,
          score_percentage: data.score_percentage ?? null,
          grade: data.grade ?? null,
          pass_mark: data.pass_mark ?? null,
        })
      } catch {
        setLookupFailed(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code])

  const issuedLabel = cert
    ? new Date(cert.issued_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 500px at 10% -10%, rgba(29,158,117,0.12), transparent 55%), radial-gradient(900px 400px at 100% 0%, rgba(232,160,32,0.10), transparent 50%), var(--page-bg)',
        fontFamily: 'var(--font)',
        padding: '36px 20px 56px',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/" style={{ fontSize: 22, color: 'var(--amber)', fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.02em' }}>
            Sphere
          </Link>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>Certificate verification</p>
        </div>

        <div
          style={{
            background: 'var(--white)',
            borderRadius: 16,
            padding: '32px 28px',
            boxShadow: 'var(--shadow-soft)',
            marginTop: 28,
            borderTop: '3px solid var(--teal)',
          }}
        >
          {loading && <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Checking verification code...</p>}

          {!loading && notFound && (
            <>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                Code not found
              </p>
              <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.65 }}>
                We could not find a certificate with code <strong>{decodeURIComponent(code).toUpperCase()}</strong>. Check the code and try again.
              </p>
            </>
          )}

          {!loading && lookupFailed && !notFound && (
            <>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                Could not verify just now
              </p>
              <p style={{ fontSize: 14, color: 'var(--mid-grey)', lineHeight: 1.65 }}>
                We could not reach the verification service. Refresh this page in a moment.
              </p>
            </>
          )}

          {!loading && cert && (
            <>
              <p
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--teal-dark, #085041)',
                  background: 'var(--teal-light, #E1F5EE)',
                  borderRadius: 6,
                  padding: '5px 9px',
                  marginBottom: 18,
                }}
              >
                Verified on Sphere
              </p>

              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 6, lineHeight: 1.5 }}>
                Issued by <span style={{ fontWeight: 600, color: 'var(--near-black)' }}>{cert.issuer_name}</span>
              </p>

              <h1
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: 'var(--near-black)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  margin: '0 0 10px',
                }}
              >
                {cert.recipient_name}
              </h1>

              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.35, marginBottom: 8 }}>
                {cert.resource_title}
              </p>

              {cert.achievement_summary && (
                <p style={{ fontSize: 15, color: 'var(--teal)', fontWeight: 500, lineHeight: 1.5, marginBottom: 14 }}>
                  {cert.achievement_summary}
                </p>
              )}

              <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6, marginBottom: 22 }}>
                This record was issued on Sphere and matches code {cert.verification_code}.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '14px 18px',
                  paddingTop: 18,
                  borderTop: '0.5px solid var(--border)',
                  marginBottom: 22,
                }}
              >
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Type
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{cert.resource_type_label}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Issued
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{issuedLabel}</p>
                </div>
                {cert.score_percentage != null && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Score
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>
                      {Math.round(cert.score_percentage)}%
                      {cert.grade ? ` · ${cert.grade}` : ''}
                    </p>
                  </div>
                )}
                {cert.pass_mark != null && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Pass mark
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)' }}>{cert.pass_mark}%</p>
                  </div>
                )}
              </div>

              <div
                style={{
                  background: 'var(--bg2)',
                  borderRadius: 10,
                  padding: '14px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Verification code
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '0.06em' }}>
                    {cert.verification_code}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
                    Scan the code to reopen this verification page from a printed certificate.
                  </p>
                </div>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`QR code for certificate ${cert.verification_code}`}
                    width={104}
                    height={104}
                    style={{ borderRadius: 6, background: '#fff', padding: 4, flexShrink: 0 }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
