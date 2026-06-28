'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Roster, RosterMember } from '@/lib/types'

export default function RosterDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const [roster, setRoster] = useState<Roster | null>(null)
  const [members, setMembers] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const [bulkText, setBulkText] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: rosterData } = await supabase.from('rosters').select('*').eq('id', id).single()
    setRoster(rosterData)

    const { data: memberData } = await supabase
      .from('roster_members')
      .select('*, users(*)')
      .eq('roster_id', id)
      .order('added_at', { ascending: false })

    setMembers((memberData ?? []) as RosterMember[])
    setLoading(false)
  }

  async function importMembers(rows: { name: string; email: string; groups?: string[] }[]) {
    const user = getCurrentUser()
    const res = await fetch(`/api/rosters/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institution_id: user.institution_id, members: rows }),
    })
    const json = await res.json()
    return { ok: res.ok, json }
  }

  async function handleManualAdd() {
    if (!name.trim() || !email.trim()) return
    setAdding(true)
    const { ok, json } = await importMembers([{ name: name.trim(), email: email.trim() }])
    setAdding(false)
    if (ok) {
      setName('')
      setEmail('')
      load()
    } else {
      alert(json.error ?? 'Could not add student.')
    }
  }

  async function handleBulkImport() {
    const rows = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(',').map(p => p.trim())
        const [studentName, studentEmail, ...groupParts] = parts
        return { name: studentName, email: studentEmail, groups: groupParts.filter(Boolean) }
      })

    if (rows.length === 0) return
    setBulkBusy(true)
    setBulkResult(null)
    const { ok, json } = await importMembers(rows)
    setBulkBusy(false)

    if (!ok) {
      setBulkResult(json.error ?? 'Import failed.')
      return
    }

    const added = json.results.filter((r: { status: string }) => r.status === 'added').length
    const failed = json.results.filter((r: { status: string }) => r.status === 'failed').length
    setBulkResult(`Added ${added} student${added === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`)
    setBulkText('')
    load()
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this student from the roster?')) return
    await supabase.from('roster_members').delete().eq('id', memberId)
    load()
  }

  async function approveMember(memberId: string) {
    await supabase.from('roster_members').update({ status: 'active' }).eq('id', memberId)
    load()
  }

  const allGroups = Array.from(new Set(members.flatMap(m => m.groups ?? [])))
  const pending = members.filter(m => m.status === 'pending')
  const active = members.filter(m => m.status === 'active' && (!groupFilter || m.groups?.includes(groupFilter)))

  const joinRosterUrl = roster?.invite_code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join-roster/${roster.invite_code}` : ''

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="students" title="Loading..." />
      </div>
    )
  }

  if (!roster) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
        <TopBar mode="students" title="Roster not found" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="students"
        title={roster.name}
        right={<Link href="/students" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>← All rosters</Link>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 920 }}>

        {/* Self-join link */}
        {roster.invite_code && (
          <div style={{ background: '#EEEDF8', border: '0.5px solid #2E288640', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#2E2886', marginBottom: 2 }}>Self-join link</p>
              <p style={{ fontSize: 13, color: '#2E2886', fontFamily: 'monospace' }}>{joinRosterUrl}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(joinRosterUrl); }}
              style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              Copy link
            </button>
          </div>
        )}

        {/* Pending approvals */}
        {pending.length > 0 && (
          <div style={{ background: '#FEF0DC', border: '0.5px solid #D97010', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#D97010', marginBottom: 10 }}>
              {pending.length} student{pending.length > 1 ? 's' : ''} waiting to join
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#18171A' }}>{m.users?.name} · {m.users?.email}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approveMember(m.id)} style={{ background: '#1A8966', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => removeMember(m.id)} style={{ background: 'transparent', boxShadow: 'var(--shadow-soft)', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add students */}
        <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>Add a student</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Student's name"
              style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Student's email"
              type="email"
              style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleManualAdd}
              disabled={adding || !name.trim() || !email.trim()}
              style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: adding || !name.trim() || !email.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>

          <button
            onClick={() => setBulkOpen(v => !v)}
            style={{ background: 'transparent', border: 'none', fontSize: 13, color: '#2E2886', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {bulkOpen ? 'Hide bulk import' : 'Bulk import multiple students'}
          </button>

          {bulkOpen && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 8 }}>
                One student per line: name, email, optional group tags separated by commas.
              </p>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'Ama Owusu, ama@school.edu.gh, 3A\nKofi Boateng, kofi@school.edu.gh, 3A, Resit'}
                rows={6}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', marginBottom: 10 }}
              />
              <button
                onClick={handleBulkImport}
                disabled={bulkBusy || !bulkText.trim()}
                style={{ background: '#2E2886', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: bulkBusy || !bulkText.trim() ? 0.6 : 1 }}
              >
                {bulkBusy ? 'Importing...' : 'Import students'}
              </button>
              {bulkResult && <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 8 }}>{bulkResult}</p>}
            </div>
          )}
        </div>

        {/* Group filter chips */}
        {allGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => setGroupFilter(null)}
              style={{ background: groupFilter === null ? '#2E2886' : '#fff', color: groupFilter === null ? '#fff' : 'var(--mid-grey)', boxShadow: 'var(--shadow-soft)', borderRadius: 14, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              All ({members.filter(m => m.status === 'active').length})
            </button>
            {allGroups.map(g => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                style={{ background: groupFilter === g ? '#2E2886' : '#fff', color: groupFilter === g ? '#fff' : 'var(--mid-grey)', boxShadow: 'var(--shadow-soft)', borderRadius: 14, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Member list */}
        <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden' }}>
          {active.length === 0 ? (
            <p style={{ padding: '32px 20px', textAlign: 'center', fontSize: 14, color: 'var(--mid-grey)' }}>No students here yet.</p>
          ) : (
            active.map((m, idx) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: idx === active.length - 1 ? 'none' : '0.5px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{m.users?.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{m.users?.email}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(m.groups ?? []).map(g => (
                    <span key={g} style={{ fontSize: 11, fontWeight: 600, color: '#2E2886', background: '#EEEDF8', padding: '2px 8px', borderRadius: 4 }}>{g}</span>
                  ))}
                  {m.user_id && (
                    <Link
                      href={`/platform/analytics/students/${m.user_id}`}
                      style={{ fontSize: 12, fontWeight: 600, color: '#2E2886', textDecoration: 'none' }}
                    >
                      Analytics
                    </Link>
                  )}
                  <button
                    onClick={() => removeMember(m.id)}
                    style={{ background: 'transparent', border: 'none', fontSize: 12, color: '#C23B2A', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
