'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { setCertificatePermission } from '@/lib/certificate-permissions'
import type { CertificatePermission } from '@/lib/types'

type Tab = 'issued' | 'templates' | 'permissions'

interface IssuedCert {
  id: string
  resource_type: string
  resource_title: string
  issued_at: string
  verification_code: string
  users?: { name: string; email: string }
  certificate_templates?: { name: string }
}

interface Template {
  id: string
  name: string
  owner_type: string
  template_type: string
  is_active: boolean
  created_at: string
  users?: { name: string; email: string }
}

const RESOURCE_COLOR: Record<string, string> = {
  exam: '#C23B2A', course: '#1A8966', training_path: '#1052A3', quiz: '#D97010',
}

export default function CertificatesPage() {
  const [tab, setTab] = useState<Tab>('issued')
  const [issued, setIssued] = useState<IssuedCert[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [permissions, setPermissions] = useState<CertificatePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [permEmail, setPermEmail] = useState('')
  const [permType, setPermType] = useState<'creator' | 'institution'>('creator')
  const [permMsg, setPermMsg] = useState('')
  const [staffId, setStaffId] = useState('')

  async function loadAll() {
    const [{ data: sessionData }, { data: issuedData }, { data: templateData }, { data: permData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from('issued_certificates').select('*, users(name, email), certificate_templates(name)').order('issued_at', { ascending: false }).limit(300),
      supabase.from('certificate_templates').select('*, users:owner_id(name, email)').order('created_at', { ascending: false }),
      supabase.from('certificate_permissions').select('*, users:owner_id(name, email)').order('updated_at', { ascending: false }),
    ])
    setStaffId(sessionData.session?.user?.id ?? '')
    setIssued((issuedData ?? []) as IssuedCert[])
    setTemplates((templateData ?? []) as Template[])
    setPermissions((permData ?? []) as CertificatePermission[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function togglePermission(row: CertificatePermission) {
    if (!staffId) return
    const result = await setCertificatePermission(row.owner_id, row.owner_type, !row.is_enabled, staffId)
    if (result.ok) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, is_enabled: !row.is_enabled } : p))
      )
    }
  }

  async function grantPermission() {
    if (!permEmail.trim() || !staffId) return
    const { data: user } = await supabase.from('users').select('id').eq('email', permEmail.trim().toLowerCase()).maybeSingle()
    if (!user) {
      setPermMsg('No user found with that email.')
      return
    }
    const result = await setCertificatePermission(user.id, permType, true, staffId)
    if (!result.ok) {
      setPermMsg(result.error)
      return
    }
    setPermEmail('')
    setPermMsg('Permission saved.')
    loadAll()
  }

  const filteredIssued = issued.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.users?.name ?? '').toLowerCase().includes(q) ||
      (c.verification_code ?? '').toLowerCase().includes(q) ||
      (c.resource_title ?? '').toLowerCase().includes(q)
    )
  })

  const filteredTemplates = templates.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
  const filteredPermissions = permissions.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (p.users?.name ?? '').toLowerCase().includes(q) || (p.users?.email ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)', letterSpacing: '-0.02em' }}>Certificates</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>{issued.length} issued total</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {Object.entries(RESOURCE_COLOR).map(([type, color]) => {
          const count = issued.filter((c) => c.resource_type === type).length
          return (
            <div key={type} style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-soft)', borderTop: `2px solid ${color}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.06em', color, marginBottom: 6 }}>{type.replace('_', ' ')}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)' }}>{count}</p>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { key: 'issued', label: `Issued (${issued.length})` },
          { key: 'templates', label: `Templates (${templates.length})` },
          { key: 'permissions', label: `Permissions (${permissions.length})` },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            height: 36, padding: '0 18px', borderRadius: 20, border: 'none',
            background: tab === t.key ? 'var(--near-black)' : 'var(--white)',
            color: tab === t.key ? '#fff' : 'var(--mid-grey)',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-soft)',
          }}>{t.label}</button>
        ))}
      </div>

      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', maxWidth: 320, height: 38, background: 'var(--white)',
          border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 14px',
          fontSize: 13, color: 'var(--near-black)', fontFamily: 'inherit',
          boxSizing: 'border-box', marginBottom: 14,
        }}
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading certificate records...</p>}

      {!loading && tab === 'issued' && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Recipient', 'Resource', 'Type', 'Code', 'Issued', 'Verify'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredIssued.map((cert, i) => {
                const color = RESOURCE_COLOR[cert.resource_type] ?? 'var(--mid-grey)'
                return (
                  <tr key={cert.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{cert.users?.name ?? '—'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cert.users?.email ?? ''}</p>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--near-black)' }}>{cert.resource_title}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color, background: `${color}15`, padding: '3px 8px', borderRadius: 20 }}>
                        {cert.resource_type?.replace('_', ' ') ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: 'var(--near-black)', letterSpacing: '0.04em' }}>
                      {cert.verification_code}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <Link href={`/verify/${cert.verification_code}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', textDecoration: 'none' }}>
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filteredIssued.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No certificates issued yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'templates' && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Name', 'Owner', 'Owner type', 'Template type', 'Status', 'Created'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((t, i) => (
                <tr key={t.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{t.name}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>{t.users?.name ?? '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--mid-grey)', textTransform: 'capitalize' }}>{t.owner_type}</td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--mid-grey)' }}>{t.template_type.replace('_', ' ')}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.is_active ? 'var(--teal)' : 'var(--text-tertiary)', background: t.is_active ? 'var(--teal-light)' : 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No templates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'permissions' && (
        <div>
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: 18, boxShadow: 'var(--shadow-soft)', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10 }}>Grant certificate issuing</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={permEmail}
                onChange={(e) => setPermEmail(e.target.value)}
                placeholder="User email"
                style={{ flex: 1, minWidth: 200, height: 38, border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }}
              />
              <select
                value={permType}
                onChange={(e) => setPermType(e.target.value as 'creator' | 'institution')}
                style={{ height: 38, border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }}
              >
                <option value="creator">Creator</option>
                <option value="institution">Institution</option>
              </select>
              <button onClick={grantPermission} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--teal)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Enable issuing
              </button>
            </div>
            {permMsg && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 8 }}>{permMsg}</p>}
          </div>

          <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--page-bg)' }}>
                  {['Owner', 'Type', 'Status', 'Updated', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((row, i) => (
                  <tr key={row.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{row.users?.name ?? '—'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{row.users?.email ?? ''}</p>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--mid-grey)', textTransform: 'capitalize' }}>{row.owner_type}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: row.is_enabled ? 'var(--teal)' : 'var(--coral)', background: row.is_enabled ? 'var(--teal-light)' : '#FEE2E2', padding: '3px 8px', borderRadius: 20 }}>
                        {row.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(row.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button
                        onClick={() => togglePermission(row)}
                        style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--white)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {row.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPermissions.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No explicit permissions yet. Issuing is allowed by default when the plan includes certificates.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
