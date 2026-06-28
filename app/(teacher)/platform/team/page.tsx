'use client'

import { useEffect, useState, useMemo } from 'react'
import TopBar from '@/components/brand/TopBar'
import InviteUsersModal from '@/components/platform/InviteUsersModal'
import { IconSearch } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  last_active_at: string | null
  avatar_initials: string
  created_at: string
  kind: 'user'
}

interface InviteRow {
  id: string
  email: string
  role: string
  department: string | null
  sent_at: string
  kind: 'invite'
}

type TabKey = 'all' | 'teacher' | 'student' | 'admin' | 'pending'

const DEPARTMENTS = ['All', 'Sales', 'Operations', 'HR', 'Finance', 'Customer Support', 'General']

function formatLastActive(iso: string | null) {
  if (!iso) return 'Never'
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'teacher') return 'Teacher'
  if (role === 'student') return 'Student'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function InviteTableRow({ inv, onCancel, isLast }: { inv: InviteRow; onCancel: (id: string) => void; isLast: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 100px 120px 120px 90px 100px',
        padding: '13px 20px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--bg2)',
        alignItems: 'center',
        background: '#FEF0DC',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FEF0DC', border: '1px solid #E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#9A5800', flexShrink: 0 }}>
          {inv.email[0].toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{inv.email}</p>
          <p style={{ fontSize: 11, color: '#9A5800' }}>Invite sent {formatLastActive(inv.sent_at)}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{roleLabel(inv.role)}</span>
      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{inv.department ?? '—'}</span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9A5800', background: '#FEF0DC', padding: '3px 8px', borderRadius: 20, border: '0.5px solid #E8A020', width: 'fit-content' }}>Pending</span>
      <button type="button" onClick={() => onCancel(inv.id)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>Cancel</button>
    </div>
  )
}

function UserTableRow({ user, isLast }: { user: UserRow; isLast: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 100px 120px 120px 90px 100px',
        padding: '13px 20px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--bg2)',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: user.role === 'admin' ? 'var(--amber-light)' : user.role === 'student' ? 'var(--blue-light)' : 'var(--teal-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: user.role === 'admin' ? '#9A5800' : user.role === 'student' ? 'var(--blue)' : 'var(--teal)',
          flexShrink: 0,
        }}>
          {user.avatar_initials || user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{user.name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user.email}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{roleLabel(user.role)}</span>
      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{user.department ?? '—'}</span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatLastActive(user.last_active_at)}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#1A8966', background: '#DDFAF0', padding: '3px 8px', borderRadius: 20, width: 'fit-content' }}>Active</span>
      <button type="button" style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>Edit</button>
    </div>
  )
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')

  const currentUser = getCurrentUser()

  async function load() {
    if (!currentUser.institution_id) {
      setLoading(false)
      return
    }

    const [usersRes, invitesRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, department, last_active_at, avatar_initials, created_at')
        .eq('institution_id', currentUser.institution_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_invites')
        .select('id, email, role, department, sent_at')
        .eq('institution_id', currentUser.institution_id)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false }),
    ])

    setUsers((usersRes.data ?? []).map(u => ({ ...u, kind: 'user' as const })))
    setInvites((invitesRes.data ?? []).map(i => ({ ...i, kind: 'invite' as const })))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => ({
    all: users.length + invites.length,
    teacher: users.filter(u => u.role === 'teacher').length,
    student: users.filter(u => u.role === 'student').length,
    admin: users.filter(u => u.role === 'admin').length,
    pending: invites.length,
  }), [users, invites])

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'teacher', label: 'Teachers', count: counts.teacher },
    { key: 'student', label: 'Students', count: counts.student },
    { key: 'admin', label: 'Admins', count: counts.admin },
    { key: 'pending', label: 'Pending invites', count: counts.pending },
  ]

  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invites.filter(inv => {
      if (deptFilter !== 'All' && inv.department !== deptFilter) return false
      if (!q) return true
      return inv.email.toLowerCase().includes(q)
    })
  }, [invites, search, deptFilter])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = users
    if (tab === 'teacher') list = list.filter(u => u.role === 'teacher')
    else if (tab === 'student') list = list.filter(u => u.role === 'student')
    else if (tab === 'admin') list = list.filter(u => u.role === 'admin')
    else if (tab === 'pending') list = []

    return list.filter(u => {
      if (deptFilter !== 'All' && u.department !== deptFilter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, tab, search, deptFilter])

  async function cancelInvite(id: string) {
    await supabase.from('user_invites').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="User management"
        right={
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            style={{
              background: 'var(--near-black)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Invite users
          </button>
        }
      />

      <InviteUsersModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSent={load}
        institutionId={currentUser.institution_id}
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
                width: '100%',
                height: 40,
                padding: '0 12px 0 36px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                color: 'var(--near-black)',
              }}
            />
          </div>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{
              height: 40,
              padding: '0 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--white)',
              boxShadow: 'var(--shadow-soft)',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--near-black)',
              cursor: 'pointer',
            }}
          >
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'Filter by department' : d}</option>
            ))}
          </select>
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
                  height: 32,
                  padding: '0 12px',
                  background: isActive ? 'var(--near-black)' : 'var(--white)',
                  boxShadow: isActive ? 'none' : 'var(--shadow-soft)',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fff' : 'var(--mid-grey)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: isActive ? 'rgba(255,255,255,0.18)' : 'var(--bg2)',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Loading users...</div>
        ) : (
          <div style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 100px 120px 120px 90px 100px',
              padding: '10px 20px',
              borderBottom: '0.5px solid var(--bg2)',
            }}>
              {['Name', 'Role', 'Department', 'Last active', 'Status', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</span>
              ))}
            </div>

            {(() => {
              const showInvites = tab === 'pending' || tab === 'all'
              const showUsers = tab !== 'pending'
              const totalRows = (showInvites ? filteredInvites.length : 0) + (showUsers ? filteredUsers.length : 0)

              if (totalRows === 0) {
                return (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
                    {tab === 'pending' ? 'No pending invites. Tap "+ Invite users" to add someone.' : 'No users match your search.'}
                  </div>
                )
              }

              let rowIndex = 0
              return (
                <>
                  {showInvites && filteredInvites.map(inv => {
                    rowIndex += 1
                    return <InviteTableRow key={inv.id} inv={inv} onCancel={cancelInvite} isLast={rowIndex === totalRows} />
                  })}
                  {showUsers && filteredUsers.map(u => {
                    rowIndex += 1
                    return <UserTableRow key={u.id} user={u} isLast={rowIndex === totalRows} />
                  })}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
