'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'issued' | 'templates'

interface IssuedCert {
  id: string
  resource_type: string
  issued_at: string
  certificate_code: string
  users?: { name: string; email: string }
  certificate_templates?: { name: string }
}

interface Template {
  id: string
  name: string
  resource_type: string
  is_active: boolean
  created_at: string
  institutions?: { name: string }
}

const RESOURCE_COLOR: Record<string, string> = {
  exam: '#C23B2A', course: '#1A8966', training_path: '#1052A3', quiz: '#D97010',
}

export default function CertificatesPage() {
  const [tab, setTab] = useState<Tab>('issued')
  const [issued, setIssued] = useState<IssuedCert[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: issuedData }, { data: templateData }] = await Promise.all([
        supabase.from('issued_certificates').select('*, users(name, email), certificate_templates(name)').order('issued_at', { ascending: false }).limit(300),
        supabase.from('certificate_templates').select('*, institutions(name)').order('created_at', { ascending: false }),
      ])
      setIssued((issuedData ?? []) as IssuedCert[])
      setTemplates((templateData ?? []) as Template[])
      setLoading(false)
    }
    load()
  }, [])

  const filteredIssued = issued.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.users?.name ?? '').toLowerCase().includes(q) || (c.certificate_code ?? '').toLowerCase().includes(q)
  })

  const filteredTemplates = templates.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

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

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {Object.entries(RESOURCE_COLOR).map(([type, color]) => {
          const count = issued.filter(c => c.resource_type === type).length
          return (
            <div key={type} style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-soft)', borderTop: `2px solid ${color}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.06em', color, marginBottom: 6 }}>{type.replace('_', ' ')}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--near-black)' }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([{ key: 'issued', label: `Issued (${issued.length})` }, { key: 'templates', label: `Templates (${templates.length})` }] as { key: Tab; label: string }[]).map(t => (
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
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', maxWidth: 320, height: 38, background: 'var(--white)',
          border: '0.5px solid var(--border)', borderRadius: 8, padding: '0 14px',
          fontSize: 13, color: 'var(--near-black)', fontFamily: 'inherit',
          boxSizing: 'border-box', marginBottom: 14,
        }}
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>Loading...</p>}

      {/* ISSUED */}
      {!loading && tab === 'issued' && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Recipient', 'Template', 'Type', 'Code', 'Issued'].map(h => (
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
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(cert as { certificate_templates?: { name: string } }).certificate_templates?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color, background: `${color}15`, padding: '3px 8px', borderRadius: 20 }}>
                        {cert.resource_type?.replace('_', ' ') ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: 'var(--near-black)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                      {cert.certificate_code}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
              {filteredIssued.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No certificates issued yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TEMPLATES */}
      {!loading && tab === 'templates' && (
        <div style={{ background: 'var(--white)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                {['Name', 'Institution', 'Type', 'Status', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((t, i) => {
                const color = RESOURCE_COLOR[t.resource_type] ?? 'var(--mid-grey)'
                return (
                  <tr key={t.id} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{t.name}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--mid-grey)' }}>
                      {(t as { institutions?: { name: string } }).institutions?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color, background: `${color}15`, padding: '3px 8px', borderRadius: 20 }}>
                        {t.resource_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.is_active ? 'var(--teal)' : 'var(--text-tertiary)', background: t.is_active ? 'var(--teal-light)' : 'var(--bg2)', padding: '3px 8px', borderRadius: 20 }}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
              {filteredTemplates.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No templates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
