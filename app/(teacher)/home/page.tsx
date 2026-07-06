'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  type ActiveContext,
  type Membership,
  getActiveContext,
  onContextChange,
  loadMemberships,
  acceptMembership,
  declineMembership,
  setActiveContext,
} from '@/lib/context'

interface QuotaRow {
  assess_quota: number
  assess_used: number
  engage_quota: number
  engage_used: number
  learn_quota: number
  learn_used: number
  train_quota: number
  train_used: number
}

interface CreationRow {
  id: string
  title: string
  kind: 'exam' | 'quiz'
  created_at: string
}

const MODULE_COLOR: Record<string, string> = { assess: '#C23B2A', engage: '#D97010', learn: '#1A8966', train: '#1052A3' }

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [tier, setTier] = useState('membership')
  const [context, setContext] = useState<ActiveContext>({ type: 'personal' })
  const [invites, setInvites] = useState<Membership[]>([])
  const [quota, setQuota] = useState<QuotaRow | null>(null)
  const [creations, setCreations] = useState<CreationRow[]>([])
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getCurrentUser()
    setUserName(user.name)
    setContext(getActiveContext())

    async function load() {
      // Tier
      const { data: userRow } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()
      setTier(userRow?.subscription_tier ?? 'membership')

      // Pending invitations
      const all = await loadMemberships(user.id)
      setInvites(all.filter(m => m.status === 'invited'))

      // Personal creation quota
      const { data: usage } = await supabase
        .from('creation_usage')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      setQuota(usage as QuotaRow | null)

      // Recent personal creations
      const [{ data: exams }, { data: quizzes }] = await Promise.all([
        supabase.from('exams').select('id, title, created_at').eq('creator_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('quizzes').select('id, title, created_at').eq('creator_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])
      const merged: CreationRow[] = [
        ...(exams ?? []).map(e => ({ ...e, kind: 'exam' as const })),
        ...(quizzes ?? []).map(q => ({ ...q, kind: 'quiz' as const })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
      setCreations(merged)

      setLoading(false)
    }
    load()

    return onContextChange(ctx => setContext(ctx))
  }, [])

  async function handleAccept(invite: Membership) {
    await acceptMembership(invite.id)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    // Jump straight into the new institution context
    setActiveContext({
      type: 'institution',
      institutionId: invite.institution_id,
      institutionName: invite.institution_name,
      memberRole: invite.member_role,
    })
  }

  async function handleDecline(invite: Membership) {
    await declineMembership(invite.id)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code) router.push(`/join?code=${encodeURIComponent(code)}`)
  }

  const firstName = userName.split(' ')[0] || 'there'
  const quotaModules = quota
    ? (['assess', 'engage', 'learn', 'train'] as const).filter(m => (quota[`${m}_quota`] ?? 0) > 0)
    : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar mode="platform" title="Home" />

      <div style={{ padding: '28px 32px 60px', maxWidth: 860 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          {loading ? 'Loading...' : `Welcome back, ${firstName}`}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 28 }}>
          {context.type === 'personal' ? 'Your personal workspace' : `Working in ${context.institutionName}`}
        </p>

        {/* Pending invitations */}
        {invites.map(invite => (
          <div key={invite.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: '#EEEDF8', border: '1px solid #C5C3EC', borderRadius: 12,
            padding: '14px 18px', marginBottom: 16,
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#2E2886' }}>
                {invite.institution_name} added you as a {invite.member_role}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>
                Accept to join their workspace. Your personal account stays yours.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleAccept(invite)} style={{
                height: 34, padding: '0 16px', borderRadius: 7, border: 'none',
                background: '#2E2886', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Join {invite.institution_name}
              </button>
              <button onClick={() => handleDecline(invite)} style={{
                height: 34, padding: '0 14px', borderRadius: 7,
                border: '0.5px solid var(--border)', background: 'var(--white)',
                color: 'var(--mid-grey)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Not now
              </button>
            </div>
          </div>
        ))}

        {/* Join by code */}
        <div className="sphere-card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Join a session</h2>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 14 }}>
            Got a code from a teacher or trainer? Enter it here.
          </p>
          <div style={{ display: 'flex', gap: 10, maxWidth: 380 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleJoin() }}
              placeholder="Enter your session code"
              style={{
                flex: 1, height: 44, padding: '0 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--white)',
                fontSize: 15, fontFamily: 'var(--font)', letterSpacing: '0.08em',
                textTransform: 'uppercase', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button onClick={handleJoin} style={{
              height: 44, padding: '0 20px', borderRadius: 8, border: 'none',
              background: 'var(--near-black)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Join now
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
            Got an institution claim code instead?{' '}
            <Link href="/claim" style={{ color: '#2E2886', fontWeight: 600, textDecoration: 'none' }}>
              Claim your membership
            </Link>
          </p>
        </div>

        {/* Creation quota (personal) */}
        {context.type === 'personal' && quota && (
          <div className="sphere-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>My creations</h2>
                <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                  {tier === 'membership' ? 'Free Membership quota' : 'Your creation pool this period'}
                </p>
              </div>
              {tier === 'membership' && (
                <Link href="/platform/settings/billing" style={{
                  fontSize: 12, fontWeight: 600, color: '#2E2886', textDecoration: 'none',
                  background: '#EEEDF8', padding: '6px 12px', borderRadius: 20,
                }}>
                  Get more with Creator →
                </Link>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
              {quotaModules.map(mod => {
                const q = quota[`${mod}_quota`]
                const used = quota[`${mod}_used`]
                const pct = Math.min((used / Math.max(q, 1)) * 100, 100)
                return (
                  <div key={mod}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: MODULE_COLOR[mod], textTransform: 'capitalize' }}>{mod}</span>
                      <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>{used} / {q}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: MODULE_COLOR[mod], borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent creations */}
        <div className="sphere-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Recent work</h2>
          {creations.length === 0 ? (
            <div style={{ padding: '18px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 12 }}>
                Nothing here yet. Create your first exam or engagement session.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/assess" style={{
                  fontSize: 13, fontWeight: 600, color: '#C23B2A', textDecoration: 'none',
                  border: '1px solid #C23B2A', padding: '8px 16px', borderRadius: 8,
                }}>
                  Create an exam
                </Link>
                <Link href="/engage" style={{
                  fontSize: 13, fontWeight: 600, color: '#D97010', textDecoration: 'none',
                  border: '1px solid #D97010', padding: '8px 16px', borderRadius: 8,
                }}>
                  Start an Engage session
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {creations.map((c, i) => (
                <Link
                  key={c.id}
                  href={c.kind === 'exam' ? `/assess/exam/${c.id}` : `/engage`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 4px', textDecoration: 'none',
                    borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: c.kind === 'exam' ? '#C23B2A' : '#D97010',
                  }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{c.kind}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
