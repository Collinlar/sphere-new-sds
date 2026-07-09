'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import TopBar from '@/components/brand/TopBar'
import InviteUsersModal from '@/components/platform/InviteUsersModal'
import { IconSearch } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getActiveContext, memberLabels, type MemberRole } from '@/lib/context'

interface MemberRow {
  id: string
  user_id: string | null
  member_role: MemberRole
  status: 'invited' | 'active' | 'removed'
  invited_email: string | null
  claim_code: string | null
  joined_at: string | null
  created_at: string
  name: string
  email: string
  avatar_initials: string
}

type TabKey = 'all' | 'teacher' | 'student' | 'admin' | 'pending'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeamPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [copiedCode, setCopiedCode] = useState('')

  const currentUser = getCurrentUser()
  const context = getActiveContext()
  const institutionId = context.type === 'institution' ? context.institutionId : currentUser.institution_id
  const [institutionTypeId, setInstitutionTypeId] = useState<string | null>(null)
  const labels = memberLabels(institutionTypeId)

  useEffect(() => {
    if (!institutionId) return
    supabase
      .from('institutions')
      .select('institution_type_id')
      .eq('id', institutionId)
      .maybeSingle()
      .then(({ data }) => setInstitutionTypeId(data?.institution_type_id ?? null))
  }, [institutionId])

  const load = useCallback(async () => {
    if (!institutionId) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('institution_members')
      .select('id, user_id, member_role, status, invited_email, claim_code, joined_at, created_at, users(name, email, avatar_initials)')
      .eq('institution_id', institutionId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false })

    const rows: MemberRow[] = (data ?? []).map(row => {
      const u = (row as unknown as { users?: { name: string; email: string; avatar_initials: string } }).users
      return {
        id: row.id,
        user_id: row.user_id,
        member_role: row.member_role as MemberRole,
        status: row.status as MemberRow['status'],
        invited_email: row.invited_email,
        claim_code: row.claim_code,
        joined_at: row.joined_at,
        created_at: row.created_at,
        name: u?.name ?? row.invited_email ?? 'Invited user',
        email: u?.email ?? row.invited_email ?? '',
        avatar_initials: u?.avatar_initials ?? (row.invited_email?.[0] ?? 'U').toUpperCase(),
      }
    })

    setMembers(rows)
    setLoading(false)
  }, [institutionId])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => ({
    all: members.length,
    teacher: members.filter(m => m.member_role === 'teacher' && m.status === 'active').length,
    student: members.filter(m => m.member_role === 'student' && m.status === 'active').length,
    admin: members.filter(m => (m.member_role === 'admin' || m.member_role === 'owner') && m.status === 'active').length,
    pending: members.filter(m => m.status === 'invited').length,
  }), [members])

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'teacher', label: labels.teachers, count: counts.teacher },
    { key: 'student', label: labels.students, count: counts.student },
    { key: 'admin', label: 'Admins', count: counts.admin },
    { key: 'pending', label: 'Pending invites', count: counts.pending },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = members
    if (tab === 'teacher') list = list.filter(m => m.member_role === 'teacher' && m.status === 'active')
    else if (tab === 'student') list = list.filter(m => m.member_role === 'student' && m.status === 'active')
    else if (tab === 'admin') list = list.filter(m => (m.member_role === 'admin' || m.member_role === 'owner') && m.status === 'active')
    else if (tab === 'pending') list = list.filter(m => m.status === 'invited')

    if (!q) return list
    return list.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, tab, search])

  async function cancelInvite(id: string) {
    await supabase.from('institution_members').delete().eq('id', id).eq('status', 'invited')
    load()
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from this institution? They keep their personal Sphere account.`)) return
    await supabase
      .from('institution_members')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  async function changeRole(id: string, newRole: string) {
    await supabase.from('institution_members').update({ member_role: newRole }).eq('id', id)
    load()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  function roleLabel(role: MemberRole) {
    if (role === 'owner') return 'Owner'
    if (role === 'admin') return 'Admin'
    if (role === 'teacher') return labels.teacher
    return labels.student
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Members"
        right={
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            style={{
              background: 'var(--near-black)', color: '#fff', border: 'none',
              borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + Invite members
          </button>
        }
      />

      <InviteUsersModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSent={load}
        institutionId={institutionId ?? ''}
        invitedBy={currentUser.id}
      />

      <div style={{ padding: '22px 24px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}>
              <IconSearch size={14} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email"
              style={{
                width: '100%', height: 40, padding: '0 12px 0 36px', borderRadius: 8,
                border: 'none', background: 'var(--white)', boxShadow: 'var(--shadow-soft)',
                fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--near-black)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(t => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  height: 32, padding: '0 12px',
                  background: isActive ? 'var(--near-black)' : 'var(--white)',
                  boxShadow: isActive ? 'none' : 'var(--shadow-soft)',
                  borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fff' : 'var(--mid-grey)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: isActive ? 'rgba(255,255,255,0.18)' : 'var(--bg2)',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Loading members...</div>
        ) : (
          <div className="r-table-scroll" style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 110px 130px 110px 90px 140px',
              minWidth: 720,
              padding: '10px 20px',
              borderBottom: '0.5px solid var(--bg2)',
            }}>
              {['Name', 'Role', 'Joined', 'Claim code', 'Status', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</span>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                {tab === 'pending' ? 'No pending invites. Tap "+ Invite members" to add someone.' : 'No members match your search.'}
              </div>
            ) : (
              filtered.map((m, i) => {
                const isPending = m.status === 'invited'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 110px 130px 110px 90px 140px',
                      minWidth: 720,
                      padding: '13px 20px',
                      borderBottom: i === filtered.length - 1 ? 'none' : '0.5px solid var(--bg2)',
                      alignItems: 'center',
                      background: isPending ? '#FEF9F1' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: m.member_role === 'owner' || m.member_role === 'admin' ? 'var(--amber-light)' : m.member_role === 'student' ? 'var(--blue-light)' : 'var(--teal-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: m.member_role === 'owner' || m.member_role === 'admin' ? '#9A5800' : m.member_role === 'student' ? 'var(--blue)' : 'var(--teal)',
                        flexShrink: 0,
                      }}>
                        {m.avatar_initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</p>
                      </div>
                    </div>

                    {/* Role — editable unless owner */}
                    {m.member_role === 'owner' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#9A5800' }}>Owner</span>
                    ) : (
                      <select
                        value={m.member_role}
                        onChange={e => changeRole(m.id, e.target.value)}
                        style={{
                          fontSize: 12, color: 'var(--mid-grey)', border: 'none', background: 'transparent',
                          fontFamily: 'inherit', cursor: 'pointer', padding: 0, width: 'fit-content',
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="teacher">{labels.teacher}</option>
                        <option value="student">{labels.student}</option>
                      </select>
                    )}

                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(m.joined_at ?? m.created_at)}</span>

                    {/* Claim code (pending invites only) */}
                    {isPending && m.claim_code ? (
                      <button
                        type="button"
                        onClick={() => copyCode(m.claim_code!)}
                        title="Copy claim code"
                        style={{
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
                          color: copiedCode === m.claim_code ? '#1A8966' : '#9A5800',
                          background: 'none', border: '0.5px dashed #E8A020', borderRadius: 5,
                          padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace', width: 'fit-content',
                        }}
                      >
                        {copiedCode === m.claim_code ? 'Copied' : m.claim_code}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                    )}

                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isPending ? '#9A5800' : '#1A8966',
                      background: isPending ? '#FEF0DC' : '#DDFAF0',
                      padding: '3px 8px', borderRadius: 20, width: 'fit-content',
                    }}>
                      {isPending ? 'Pending' : 'Active'}
                    </span>

                    <div style={{ display: 'flex', gap: 12 }}>
                      {isPending ? (
                        <button type="button" onClick={() => cancelInvite(m.id)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                          Cancel invite
                        </button>
                      ) : m.member_role !== 'owner' ? (
                        <button type="button" onClick={() => removeMember(m.id, m.name)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--coral)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
