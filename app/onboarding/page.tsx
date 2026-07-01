'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { autoClaimBrowserSessions } from '@/lib/guest-sessions'

type ModuleKey = 'engage' | 'assess' | 'learn' | 'train'

const MODULE_COLORS: Record<ModuleKey, string> = {
  engage: '#D97010',
  assess: '#C23B2A',
  learn: '#1A8966',
  train: '#1052A3',
}

const MODULE_LIGHT: Record<ModuleKey, string> = {
  engage: '#FEF0DC',
  assess: '#FDECEA',
  learn: '#DDFAF0',
  train: '#E3EDFB',
}

const MODULE_PRICES: Record<ModuleKey, number> = {
  engage: 120,
  assess: 150,
  learn: 150,
  train: 200,
}

const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  engage: 'Live quizzes and game-based learning',
  assess: 'Formal exams with real-time invigilation',
  learn: 'Structured courses, video, and assignments',
  train: 'Compliance paths and team skill tracking',
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
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([])

  const [institutionName, setInstitutionName] = useState('')
  const [city, setCity] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTypeSelect(type: InstitutionTypeOption) {
    setSelectedType(type)
    setSelectedModules(type.defaultModules)
    setStep(2)
  }

  function toggleModule(mod: ModuleKey) {
    setSelectedModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }

  const totalPrice = selectedModules.reduce((sum, m) => sum + MODULE_PRICES[m], 0)

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: adminName },
        },
      })

      if (authError || !authData.user) {
        setError(authError?.message ?? 'Could not create your account. Check your details and try again.')
        setLoading(false)
        return
      }

      const modulesObj = {
        engage: selectedModules.includes('engage'),
        assess: selectedModules.includes('assess'),
        learn: selectedModules.includes('learn'),
        train: selectedModules.includes('train'),
      }

      const { data: institution, error: instError } = await supabase
        .from('institutions')
        .insert({
          name: institutionName,
          type: selectedType?.id ?? 'school',
          institution_type_id: selectedType?.id ?? null,
          modules: modulesObj,
          subscription_plan: 'membership',
        })
        .select()
        .single()

      if (instError || !institution) {
        setError(`Institution setup did not complete. ${instError?.message ?? ''}`)
        setLoading(false)
        return
      }

      const initials = adminName
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

      await supabase.from('users').insert({
        id: authData.user.id,
        institution_id: institution.id,
        name: adminName,
        email,
        role: 'admin',
        avatar_initials: initials,
        subscription_tier: 'institution',
      })

      // Initialise creation usage row (unlimited for institution, but row must exist)
      await supabase.from('creation_usage').insert({
        user_id: authData.user.id,
        assess_quota: 9999,
        engage_quota: 9999,
        learn_quota: 9999,
        train_quota: 9999,
      })

      const userRecord = {
        id: authData.user.id,
        name: adminName,
        email,
        role: 'admin',
        institution_id: institution.id,
        avatar_initials: initials,
        subscription_tier: 'institution',
      }

      localStorage.setItem('sphere_user', JSON.stringify(userRecord))
      localStorage.setItem('sphere_institution', institutionName)

      // Claim any guest sessions from this browser
      await autoClaimBrowserSessions(authData.user.id)

      const firstModule = selectedModules[0] ?? 'engage'
      router.push(`/${firstModule}`)
    } catch {
      setError('Something went wrong. Try again in a moment.')
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
                  {t.defaultModules.map(m => (
                    <span
                      key={m}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: MODULE_COLORS[m],
                        background: MODULE_LIGHT[m],
                        padding: '2px 8px',
                        borderRadius: 20,
                      }}
                    >
                      {m}
                    </span>
                  ))}
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
              Continue
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--mid-grey)' }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Back
            </button>
          </p>
        </div>
      )}

      {/* Step 3: Choose modules */}
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
            Choose your modules
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>
            Pre-selected for your institution type. Add or remove as needed.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {(['engage', 'assess', 'learn', 'train'] as ModuleKey[]).map(mod => {
              const active = selectedModules.includes(mod)
              const color = MODULE_COLORS[mod]
              return (
                <button
                  key={mod}
                  onClick={() => toggleModule(mod)}
                  style={{
                    background: 'var(--white)',
                    border: 'none',
                    borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    boxShadow: active ? `0 0 0 1.5px ${color}` : 'var(--shadow-soft)',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: active ? MODULE_LIGHT[mod] : 'var(--bg2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? color : 'var(--text-tertiary)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: active ? 'var(--near-black)' : 'var(--mid-grey)', textTransform: 'capitalize' }}>
                        {mod}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2 }}>
                        {MODULE_DESCRIPTIONS[mod]}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? color : 'var(--text-tertiary)', flexShrink: 0, marginLeft: 12 }}>
                    GHS {MODULE_PRICES[mod]}/mo
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{
            background: 'var(--white)',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            boxShadow: 'var(--shadow-soft)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--mid-grey)' }}>
              {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--near-black)' }}>
              GHS {totalPrice}/month
            </span>
          </div>

          <button
            onClick={() => setStep(4)}
            disabled={selectedModules.length === 0}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--near-black)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: selectedModules.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedModules.length === 0 ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            Continue
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
            Free Membership plan. No card required. Upgrade when you need more.
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

            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Modules</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {selectedModules.map(mod => (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODULE_COLORS[mod] }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', textTransform: 'capitalize' }}>{mod}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>GHS {MODULE_PRICES[mod]}/mo</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '0.5px solid var(--bg2)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Starting at</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)' }}>GHS {totalPrice}/month</p>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--teal)',
                background: 'var(--teal-light)',
                padding: '6px 12px',
                borderRadius: 20,
              }}>
                Free to start
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
