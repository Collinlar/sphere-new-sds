'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getCreationUsage, getEffectivePlanId } from '@/lib/subscription'
import { quotaRenewsAt } from '@/lib/plan-upgrade'
import type { SubscriptionTier } from '@/lib/types'
import { fetchScopedContent } from '@/lib/library-scope'
import { isAcquiredRow, getAcquisitionUseHref, getAcquisitionTakeLabel, fetchAcquiredContentIds } from '@/lib/acquisition-access'
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
  period_start?: string | null
}

interface AcquisitionRow {
  id: string
  title: string
  kind: 'quiz' | 'exam' | 'course' | 'path'
  module: 'engage' | 'assess' | 'learn' | 'train'
  readyToUse: boolean
  href: string
  takeLabel: string
  progressLabel: string | null
  created_at: string
}

const KIND_LABEL: Record<AcquisitionRow['kind'], string> = {
  quiz: 'Quiz',
  exam: 'Exam',
  course: 'Course',
  path: 'Training path',
}

const MODULE_COLOR: Record<string, string> = { assess: '#C23B2A', engage: '#D97010', learn: '#1A8966', train: '#1052A3' }

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [tier, setTier] = useState('membership')
  const [context, setContext] = useState<ActiveContext>({ type: 'personal' })
  const [invites, setInvites] = useState<Membership[]>([])
  const [quota, setQuota] = useState<QuotaRow | null>(null)
  const [acquisitions, setAcquisitions] = useState<AcquisitionRow[]>([])
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
      const usage = await getCreationUsage(user.id)
      setQuota(usage as QuotaRow | null)

      // Personal acquisitions (scoped shelf)
      const personalScope = {
        institutionId: null as string | null,
        creatorId: user.id,
        label: 'Personal library',
      }
      const [quizzes, exams, courses, paths, acquiredIds] = await Promise.all([
        fetchScopedContent<{ id: string; title: string; created_at: string; marketplace_listing_id?: string; settings?: Record<string, unknown> }>('quizzes', personalScope),
        fetchScopedContent<{ id: string; title: string; created_at: string; marketplace_listing_id?: string; settings?: Record<string, unknown> }>('exams', personalScope),
        fetchScopedContent<{ id: string; title: string; created_at: string; marketplace_listing_id?: string; settings?: Record<string, unknown> }>('courses', personalScope),
        fetchScopedContent<{ id: string; title: string; created_at: string; marketplace_listing_id?: string; settings?: Record<string, unknown> }>('learning_paths', personalScope),
        fetchAcquiredContentIds(personalScope),
      ])

      const courseIds = courses.map((c) => c.id)
      const pathIds = paths.map((p) => p.id)
      const examIds = exams.map((e) => e.id)

      const [enrollRows, pathEnrollRows, examSubRows] = await Promise.all([
        courseIds.length
          ? supabase.from('enrollments').select('course_id, progress_percentage').eq('student_id', user.id).in('course_id', courseIds)
          : Promise.resolve({ data: [] }),
        pathIds.length
          ? supabase.from('path_enrollments').select('path_id, progress_percentage').eq('employee_id', user.id).in('path_id', pathIds)
          : Promise.resolve({ data: [] }),
        examIds.length
          ? supabase.from('exam_submissions').select('id, grade, percentage, exam_sessions(exam_id, settings)').eq('student_id', user.id).not('submitted_at', 'is', null)
          : Promise.resolve({ data: [] }),
      ])

      const courseProgress = new Map((enrollRows.data ?? []).map((r) => [r.course_id as string, r.progress_percentage as number]))
      const pathProgress = new Map((pathEnrollRows.data ?? []).map((r) => [r.path_id as string, r.progress_percentage as number]))
      const examGrades = new Map<string, string>()
      for (const sub of examSubRows.data ?? []) {
        const session = sub.exam_sessions as { exam_id?: string; settings?: Record<string, unknown> } | null
        if (session?.settings?.self_serve && session.exam_id && sub.grade) {
          examGrades.set(session.exam_id, sub.grade as string)
        }
      }

      function progressFor(kind: AcquisitionRow['kind'], id: string, acquired: boolean): string | null {
        if (!acquired) return null
        if (kind === 'course') {
          const pct = courseProgress.get(id)
          return pct != null ? `${pct}% complete` : 'Not started'
        }
        if (kind === 'path') {
          const pct = pathProgress.get(id)
          return pct != null ? `${pct}% complete` : 'Not started'
        }
        if (kind === 'exam') {
          const grade = examGrades.get(id)
          return grade ? `Last grade: ${grade}` : 'Not taken yet'
        }
        return null
      }

      function buildRow(
        row: { id: string; title: string; created_at: string; marketplace_listing_id?: string; settings?: Record<string, unknown> },
        kind: AcquisitionRow['kind'],
        module: AcquisitionRow['module']
      ): AcquisitionRow {
        const acquired = acquiredIds.has(row.id) || isAcquiredRow(row as Record<string, unknown>)
        return {
          id: row.id,
          title: row.title,
          kind,
          module,
          readyToUse: acquired,
          href: acquired
            ? getAcquisitionUseHref(kind, row.id)
            : module === 'engage'
              ? `/engage/builder?id=${row.id}`
              : `/platform/settings/billing?locked=${module}`,
          takeLabel: getAcquisitionTakeLabel(kind),
          progressLabel: progressFor(kind, row.id, acquired),
          created_at: row.created_at,
        }
      }

      const rows: AcquisitionRow[] = [
        ...quizzes.map((q) => buildRow(q, 'quiz', 'engage')),
        ...exams.map((e) => buildRow(e, 'exam', 'assess')),
        ...courses.map((c) => buildRow(c, 'course', 'learn')),
        ...paths.map((p) => buildRow(p, 'path', 'train')),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)
      setAcquisitions(rows)

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
    ? tier === 'membership'
      ? (quota.engage_quota > 0 ? (['engage'] as const) : [])
      : (['assess', 'engage', 'learn', 'train'] as const).filter(m => (quota[`${m}_quota`] ?? 0) > 0)
    : []

  const quotaLabel = (mod: string) =>
    tier === 'membership' && mod === 'engage' ? 'Engage sessions' : mod

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

        {/* Marketplace + library (personal) */}
        {context.type === 'personal' && (
          <div className="sphere-card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/platform/marketplace" style={{
              flex: '1 1 200px', padding: '16px 18px', borderRadius: 10,
              background: 'var(--teal-light)', textDecoration: 'none',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)', marginBottom: 4 }}>Browse marketplace</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
                Import free resources or buy with MoMo
              </p>
            </Link>
            <Link href="/platform/library" style={{
              flex: '1 1 200px', padding: '16px 18px', borderRadius: 10,
              background: '#EEEDF8', textDecoration: 'none',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#2E2886', marginBottom: 4 }}>Open my library</p>
              <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.5 }}>
                Everything you have saved from the marketplace
              </p>
            </Link>
          </div>
        )}

        {/* Creation quota (personal) */}
        {context.type === 'personal' && quota && (() => {
          const renewsAt = quotaRenewsAt(tier as SubscriptionTier, quota.period_start ?? null)
          const renewLabel = renewsAt
            ? renewsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : null
          // Natural-but-urging: quiet meter always; amber nudge when close.
          const nearLimit = quotaModules.some(mod => {
            const q = quota[`${mod}_quota`]
            return q > 0 && q - quota[`${mod}_used`] <= 1
          })
          return (
            <div className="sphere-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>My creations</h2>
                  <p style={{ fontSize: 13, color: 'var(--mid-grey)' }}>
                    {tier === 'membership' ? 'Free Membership · Engage sessions' : 'Your creation pool this period'}
                    {renewLabel ? ` · renews ${renewLabel}` : ''}
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
                  const remaining = q - used
                  const tight = q > 0 && remaining <= 1
                  return (
                    <div key={mod}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: MODULE_COLOR[mod], textTransform: 'capitalize' }}>{quotaLabel(mod)}</span>
                        <span style={{ fontSize: 12, fontWeight: tight ? 700 : 400, color: tight ? '#9A5800' : 'var(--mid-grey)' }}>{used} / {q}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: tight ? '#E8A020' : MODULE_COLOR[mod], borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {nearLimit && tier === 'membership' && (
                <div style={{ marginTop: 14, background: '#FEF9F1', border: '1px solid #E8A020', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 12, color: '#9A5800', lineHeight: 1.5 }}>
                    You are almost at your monthly limit{renewLabel ? `, renews ${renewLabel}` : ''}. Creator gives you all four modes and no session caps.
                  </p>
                  <Link href="/platform/settings/billing" style={{ fontSize: 12, fontWeight: 700, color: '#9A5800', textDecoration: 'underline', flexShrink: 0 }}>
                    See Creator plans
                  </Link>
                </div>
              )}
            </div>
          )
        })()}

        {/* My acquisitions */}
        <div className="sphere-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>
              {context.type === 'personal' ? 'My acquisitions' : 'Recent work'}
            </h2>
            {context.type === 'personal' && acquisitions.length > 0 && (
              <Link href="/platform/library" style={{ fontSize: 12, fontWeight: 600, color: '#2E2886', textDecoration: 'none' }}>
                View all →
              </Link>
            )}
          </div>
          {acquisitions.length === 0 ? (
            <div style={{ padding: '18px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 12 }}>
                {context.type === 'personal'
                  ? 'Nothing saved yet. Browse the marketplace and import free resources to your personal library.'
                  : 'Nothing here yet. Build a quiz and start your first Engage session.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {context.type === 'personal' ? (
                  <Link href="/platform/marketplace" style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none',
                    border: '1px solid var(--teal)', padding: '8px 16px', borderRadius: 8,
                  }}>
                    Browse marketplace
                  </Link>
                ) : (
                  <>
                    {tier !== 'membership' && (
                      <Link href="/assess" style={{
                        fontSize: 13, fontWeight: 600, color: '#C23B2A', textDecoration: 'none',
                        border: '1px solid #C23B2A', padding: '8px 16px', borderRadius: 8,
                      }}>
                        Create an exam
                      </Link>
                    )}
                    <Link href="/engage" style={{
                      fontSize: 13, fontWeight: 600, color: '#D97010', textDecoration: 'none',
                      border: '1px solid #D97010', padding: '8px 16px', borderRadius: 8,
                    }}>
                      Start an Engage session
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              {acquisitions.map((c, i) => (
                <Link
                  key={`${c.kind}-${c.id}`}
                  href={c.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 4px', textDecoration: 'none',
                    borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: MODULE_COLOR[c.module],
                  }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>
                    {c.title}
                    {c.progressLabel && (
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--mid-grey)', marginTop: 2, fontWeight: 400 }}>
                        {c.progressLabel}
                      </span>
                    )}
                  </span>
                  {c.readyToUse && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#1A8966',
                      background: '#DDFAF0', padding: '2px 8px', borderRadius: 20,
                    }}>
                      Ready to take
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{KIND_LABEL[c.kind]}</span>
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
