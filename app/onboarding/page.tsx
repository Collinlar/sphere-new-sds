'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { autoClaimBrowserSessions } from '@/lib/guest-sessions'
import { loadMemberships, setActiveContext } from '@/lib/context'

type ModuleKey = 'engage' | 'assess' | 'learn' | 'train'

const MODULE_COLORS: Record<ModuleKey, string> = {
  engage: '#D97010',
  assess: '#C23B2A',
  learn: '#1A8966',
  train: '#1052A3',
}

interface InstitutionTypeOption {
  id: string
  name: string
  shortLabel: string
  defaultModules: ModuleKey[]
  accent: string
  periodLabel: string
  levelSample: string
}

const INSTITUTION_TYPES: InstitutionTypeOption[] = [
  {
    id: 'primary',
    name: 'Primary School',
    shortLabel: 'Primary 1 to Primary 6 · Terms',
    defaultModules: ['engage', 'assess', 'learn'],
    accent: '#1A8966',
    periodLabel: 'Term',
    levelSample: 'Primary 1 – 6',
  },
  {
    id: 'jhs',
    name: 'Junior High School (JHS)',
    shortLabel: 'JHS 1 – 3 · Terms',
    defaultModules: ['engage', 'assess', 'learn'],
    accent: '#1A8966',
    periodLabel: 'Term',
    levelSample: 'JHS 1, JHS 2, JHS 3',
  },
  {
    id: 'shs',
    name: 'Senior High School (SHS)',
    shortLabel: 'SHS 1 – 3 · Terms',
    defaultModules: ['engage', 'assess', 'learn'],
    accent: '#C23B2A',
    periodLabel: 'Term',
    levelSample: 'SHS 1, SHS 2, SHS 3',
  },
  {
    id: 'university',
    name: 'University',
    shortLabel: 'Year 1 – 4 · Semesters',
    defaultModules: ['engage', 'assess', 'learn', 'train'],
    accent: '#2E2886',
    periodLabel: 'Semester',
    levelSample: 'Year 1 – Year 4',
  },
  {
    id: 'college',
    name: 'Polytechnic / College',
    shortLabel: 'Level 100 – 400 · Semesters',
    defaultModules: ['engage', 'assess', 'learn'],
    accent: '#1052A3',
    periodLabel: 'Semester',
    levelSample: 'Level 100 – 400',
  },
  {
    id: 'training',
    name: 'Training Institution',
    shortLabel: 'Cohort-based · Intake periods',
    defaultModules: ['learn', 'assess', 'train'],
    accent: '#D97010',
    periodLabel: 'Intake',
    levelSample: 'Cohort-based',
  },
  {
    id: 'corporate',
    name: 'Company / Corporate',
    shortLabel: 'Departments · Quarterly',
    defaultModules: ['train'],
    accent: '#1052A3',
    periodLabel: 'Quarter',
    levelSample: 'Q1 – Q4',
  },
  {
    id: 'professional',
    name: 'Professional Body',
    shortLabel: 'Foundation to Professional · Semesters',
    defaultModules: ['assess', 'learn'],
    accent: '#2E2886',
    periodLabel: 'Semester',
    levelSample: 'Foundation → Professional',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<InstitutionTypeOption | null>(null)

  const [institutionName, setInstitutionName] = useState('')
  const [city, setCity] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTypeSelect(type: InstitutionTypeOption) {
    setSelectedType(type)
    setStep(2)
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      // 1. Auth account first. Retries after a failed setup often already have
      // an auth user, so fall back to sign-in with the same password.
      let userId: string | null = null
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: adminName.trim() },
        },
      })

      const signupLooksDuplicate =
        (!!authError?.message && /already|registered|exists/i.test(authError.message)) ||
        (!!authData.user && (authData.user.identities?.length ?? 0) === 0)

      if (authData.user && !signupLooksDuplicate) {
        userId = authData.user.id
      } else if (signupLooksDuplicate || authError) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError || !signInData.user) {
          if (signupLooksDuplicate) {
            setError(
              'This email already has an account from an earlier attempt. Use the same password to continue, or sign in first.'
            )
          } else {
            setError(authError?.message ?? 'Could not create your account. Check your details and try again.')
          }
          setLoading(false)
          return
        }
        userId = signInData.user.id
      }

      if (!userId) {
        setError('Could not create your account. Check your details and try again.')
        setLoading(false)
        return
      }

      // Ensure we have an authenticated session before RLS-protected inserts.
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        const { error: sessionError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (sessionError) {
          setError('Your login session did not start. Confirm your email if required, then try again.')
          setLoading(false)
          return
        }
      }

      const initials = adminName
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

      // 2. public.users must exist before institutions.owner_user_id can reference it.
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, institution_id')
        .eq('id', userId)
        .maybeSingle()

      if (!existingProfile) {
        const { error: userError } = await supabase.from('users').insert({
          id: userId,
          institution_id: null,
          name: adminName.trim(),
          email: email.trim(),
          role: 'admin',
          avatar_initials: initials,
          subscription_tier: 'membership',
        })

        if (userError) {
          setError(`Your account was created, but the administrator profile did not save. ${userError.message}`)
          setLoading(false)
          return
        }
      } else if (existingProfile.institution_id) {
        setError('This account is already linked to an institution. Sign in to continue.')
        setLoading(false)
        return
      } else {
        await supabase
          .from('users')
          .update({
            name: adminName.trim(),
            email: email.trim(),
            role: 'admin',
            avatar_initials: initials,
            subscription_tier: 'membership',
          })
          .eq('id', userId)
      }

      // 3. Create the institution now that the owner profile exists.
      const { data: institution, error: instError } = await supabase
        .from('institutions')
        .insert({
          name: institutionName.trim(),
          city: city.trim(),
          type: selectedType?.id ?? 'school',
          institution_type_id: selectedType?.id ?? null,
          owner_user_id: userId,
          modules: ['engage'],
          subscription_plan: 'membership',
        })
        .select()
        .single()

      if (instError || !institution) {
        setError(`Institution setup did not complete. ${instError?.message ?? ''}`)
        setLoading(false)
        return
      }

      // 4. Link the admin profile to the new institution.
      const { error: linkError } = await supabase
        .from('users')
        .update({ institution_id: institution.id, role: 'admin' })
        .eq('id', userId)

      if (linkError) {
        setError(`Your institution was created, but linking your admin profile failed. ${linkError.message}`)
        setLoading(false)
        return
      }

      const { error: memberError } = await supabase.from('institution_members').insert({
        institution_id: institution.id,
        user_id: userId,
        member_role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        setError('Your institution was created, but ownership did not register. Contact Sphere support.')
        setLoading(false)
        return
      }

      await supabase.from('creation_usage').upsert({
        user_id: userId,
        assess_quota: 0,
        engage_quota: 5,
        learn_quota: 0,
        train_quota: 0,
      })

      const userRecord = {
        id: userId,
        name: adminName.trim(),
        email: email.trim(),
        role: 'admin',
        institution_id: institution.id,
        avatar_initials: initials,
        subscription_tier: 'membership',
      }

      localStorage.setItem('sphere_user', JSON.stringify(userRecord))
      localStorage.setItem('sphere_institution', institutionName.trim())
      await loadMemberships(userId)
      setActiveContext({
        type: 'institution',
        institutionId: institution.id,
        institutionName: institutionName.trim(),
        memberRole: 'owner',
      })

      await autoClaimBrowserSessions(userId)

      router.push('/engage')
    } catch {
      setError('Your institution setup did not finish. Check your connection and try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'var(--bg2)',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--near-black)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--mid-grey)',
    marginBottom: 6,
  }

  function StepDots() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            style={{
              width: s === step ? 28 : 7,
              height: 7,
              borderRadius: s === step ? 4 : '50%',
              background: s === step ? 'var(--amber)' : s < step ? 'var(--near-black)' : 'var(--bg2)',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>
    )
  }

  function Logo({ size = 17 }: { size?: number }) {
    return (
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--near-black)' }}>
        Sphere<span style={{ color: 'var(--amber)' }}>SDS</span>
      </span>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#D5D4D1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 48px',
      fontFamily: 'var(--font)',
    }}>

      {/* Step 1: Institution type */}
      {step === 1 && (
        <div style={{
          width: '100%',
          maxWidth: 680,
          background: 'var(--page-bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-card)',
          padding: '44px 40px 48px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="var(--amber)" strokeWidth="1.5" />
                <ellipse cx="12" cy="12" rx="5" ry="11" stroke="var(--amber)" strokeWidth="1.2" />
                <line x1="1" y1="12" x2="23" y2="12" stroke="var(--amber)" strokeWidth="1.2" />
                <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="var(--amber)" strokeWidth="1" />
                <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="var(--amber)" strokeWidth="1" />
              </svg>
              <Logo />
            </div>
            <StepDots />
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            What kind of institution are you setting up?
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 28 }}>
            This loads your academic structure automatically — levels, period language, and calendar.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {INSTITUTION_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => handleTypeSelect(t)}
                style={{
                  background: 'var(--white)',
                  border: 'none',
                  borderLeft: `3px solid ${t.accent}`,
                  borderRadius: 12,
                  padding: '20px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: 'var(--shadow-soft)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 14px ${t.accent}29, 0 0 0 1.5px ${t.accent}` }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-soft)' }}
              >
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>{t.name}</p>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 10 }}>{t.levelSample}</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{t.periodLabel} structure</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Institution details */}
      {step === 2 && (
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--page-bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-card)',
          padding: '44px 36px 44px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <Logo />
            <StepDots />
          </div>

          {selectedType && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg2)',
              borderRadius: 20,
              padding: '4px 12px',
              marginBottom: 18,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedType.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid-grey)' }}>{selectedType.name}</span>
            </div>
          )}

          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 5 }}>
            About your institution
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 26 }}>
            Sets up your admin account and institution profile.
          </p>

          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '24px 22px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Institution name</label>
              <input
                type="text"
                placeholder="What's your institution called?"
                value={institutionName}
                onChange={e => setInstitutionName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                placeholder="Which city are you based in?"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Your full name</label>
              <input
                type="text"
                placeholder="Your full name"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Work email</label>
              <input
                type="email"
                placeholder="Your work email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="Create a password (8+ characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
              />
            </div>

            <button
              onClick={() => {
                if (!institutionName || !city || !adminName || !email || password.length < 8) return
                setStep(3)
              }}
              disabled={!institutionName || !city || !adminName || !email || password.length < 8}
              style={{
                height: 48,
                background: 'var(--near-black)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: (!institutionName || !city || !adminName || !email || password.length < 8) ? 'not-allowed' : 'pointer',
                opacity: (!institutionName || !city || !adminName || !email || password.length < 8) ? 0.5 : 1,
                fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              Review my plan
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--mid-grey)' }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Back
            </button>
          </p>
        </div>
      )}

      {/* Step 3: Institution plan path */}
      {step === 3 && (
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--page-bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-card)',
          padding: '44px 36px 44px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <Logo />
            <StepDots />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 5 }}>
            Your institution plan
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>
            Start free today, then upgrade this institution when your team is ready.
          </p>

          <div style={{ background: 'var(--white)', borderLeft: '3px solid #D97010', borderRadius: 10, padding: '18px 20px', boxShadow: 'var(--shadow-soft)', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9A5800', marginBottom: 5 }}>What you have today</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 12 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)' }}>Free Membership</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--near-black)' }}>GHS 0</p>
            </div>
            {['Engage live sessions', '5 live sessions included', 'Up to 5 students per session'].map(item => (
              <p key={item} style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6 }}>✓ {item}</p>
            ))}
          </div>

          <div style={{ background: 'var(--white)', borderLeft: '3px solid #1A8966', borderRadius: 10, padding: '18px 20px', boxShadow: 'var(--shadow-soft)', marginBottom: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#085041', marginBottom: 5 }}>Your only account upgrade</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 12 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--near-black)' }}>Institution</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#085041' }}>GHS 1,000/quarter</p>
            </div>
            {['Assess, Engage, Learn, and Train', 'Unlimited creations', '100 enrolled students included', 'Certificates and institution templates'].map(item => (
              <p key={item} style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6 }}>✓ {item}</p>
            ))}
            <p style={{ fontSize: 12, color: 'var(--mid-grey)', lineHeight: 1.6, marginTop: 10 }}>
              You can upgrade from Institution billing after your account is ready.
            </p>
          </div>

          <button
            onClick={() => setStep(4)}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--near-black)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Review my setup
          </button>

          <p style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={() => setStep(2)}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
            >
              Back
            </button>
          </p>
        </div>
      )}

      {/* Step 4: Summary + create account */}
      {step === 4 && (
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--page-bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-card)',
          padding: '44px 36px 44px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <Logo />
            <StepDots />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 5 }}>
            Ready to set up your account
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>
            Your institution starts free. No card required.
          </p>

          <div style={{ background: 'var(--white)', borderRadius: 12, padding: 22, boxShadow: 'var(--shadow-soft)', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {selectedType && (
                <span style={{ fontSize: 11, fontWeight: 600, color: selectedType.accent, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20 }}>
                  {selectedType.name}
                </span>
              )}
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--near-black)', marginBottom: 20 }}>{institutionName}</p>

            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>What is active now</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODULE_COLORS.engage }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>Engage</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>5 free sessions</span>
            </div>

            <div style={{ borderTop: '0.5px solid var(--bg2)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Current plan</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--near-black)' }}>Free Membership</p>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--teal)',
                background: 'var(--teal-light)',
                padding: '6px 12px',
                borderRadius: 20,
              }}>
                GHS 0 today
              </span>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--coral-light)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 13,
              color: 'var(--coral)',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              height: 52,
              background: 'var(--amber)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            {loading ? 'Setting up your account...' : 'Create my account'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--mid-grey)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
          </p>

          <button
            onClick={() => setStep(3)}
            style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
