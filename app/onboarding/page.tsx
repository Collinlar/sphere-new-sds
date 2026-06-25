'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type InstitutionType = 'school' | 'company' | 'individual' | 'university'
type ModuleKey = 'engage' | 'assess' | 'learn' | 'train'

const MODULE_COLORS: Record<ModuleKey, string> = {
  engage: '#EF9F27',
  assess: '#E05C4B',
  learn: '#2BA888',
  train: '#185FA5',
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

const INSTITUTION_TYPES: Array<{
  key: InstitutionType
  label: string
  sublabel: string
  defaultModules: ModuleKey[]
  accent: string
}> = [
  {
    key: 'school',
    label: 'School or college',
    sublabel: 'Includes Engage, Assess, and Learn',
    defaultModules: ['engage', 'assess', 'learn'],
    accent: '#2BA888',
  },
  {
    key: 'company',
    label: 'Company or team',
    sublabel: 'Includes Train',
    defaultModules: ['train'],
    accent: '#185FA5',
  },
  {
    key: 'individual',
    label: 'Individual educator',
    sublabel: 'Includes Learn',
    defaultModules: ['learn'],
    accent: '#2BA888',
  },
  {
    key: 'university',
    label: 'University or polytechnic',
    sublabel: 'Includes all four modules',
    defaultModules: ['engage', 'assess', 'learn', 'train'],
    accent: '#36318F',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [institutionType, setInstitutionType] = useState<InstitutionType | null>(null)
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([])

  const [institutionName, setInstitutionName] = useState('')
  const [city, setCity] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTypeSelect(type: InstitutionType, modules: ModuleKey[]) {
    setInstitutionType(type)
    setSelectedModules(modules)
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
          data: { name: adminName, institution_type: institutionType },
        },
      })

      if (authError || !authData.user) {
        setError(authError?.message ?? 'We could not create your account. Check your details and try again.')
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
          type: institutionType,
          modules: modulesObj,
          subscription_plan: 'trial',
        })
        .select()
        .single()

      if (instError || !institution) {
        setError(`Institution setup failed: ${instError?.message ?? 'unknown error'}`)
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
      })

      localStorage.setItem(
        'sphere_user',
        JSON.stringify({
          id: authData.user.id,
          name: adminName,
          email,
          role: 'admin',
          institution_id: institution.id,
          avatar_initials: initials,
        })
      )
      localStorage.setItem('sphere_institution', institutionName)

      const firstModule = selectedModules[0] ?? 'engage'
      router.push(`/${firstModule}`)
    } catch {
      setError('Something went wrong on our end. Try again in a moment.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: '#EAE6DC',
    fontSize: 16,
    fontFamily: 'inherit',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#4B5563',
    marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EFE9DD',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 48px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="#EF9F27" strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="5" ry="11" stroke="#EF9F27" strokeWidth="1.2" />
          <line x1="1" y1="12" x2="23" y2="12" stroke="#EF9F27" strokeWidth="1.2" />
          <line x1="3.5" y1="6" x2="20.5" y2="6" stroke="#EF9F27" strokeWidth="1" />
          <line x1="3.5" y1="18" x2="20.5" y2="18" stroke="#EF9F27" strokeWidth="1" />
        </svg>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827' }}>
          Sphere<span style={{ color: '#EF9F27' }}>SDS</span>
        </span>
      </div>

      {/* Step dots */}
      {step > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              style={{
                width: s === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: s === step ? '#EF9F27' : s < step ? '#111827' : '#D1CBC0',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Step 1: Institution type */}
      {step === 1 && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#111827', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>
            What kind of institution are you setting up?
          </h1>
          <p style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', marginBottom: 32 }}>
            This determines which modules are ready for you on day one.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {INSTITUTION_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => handleTypeSelect(t.key, t.defaultModules)}
                style={{
                  background: '#fff',
                  border: `0.5px solid #E2DDD3`,
                  borderRadius: 12,
                  padding: '24px 22px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = t.accent
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${t.accent}18`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E2DDD3'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  {t.defaultModules.map(m => (
                    <span
                      key={m}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: MODULE_COLORS[m],
                        background: `${MODULE_COLORS[m]}14`,
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 13, color: '#4B5563' }}>{t.sublabel}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Institution details */}
      {step === 2 && (
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Tell us about your institution
          </h1>
          <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 28 }}>This sets up your admin account and institution profile.</p>

          <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Institution name</label>
              <input
                type="text"
                placeholder="What's your institution called?"
                value={institutionName}
                onChange={e => setInstitutionName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
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
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
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
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
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
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
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
                onFocus={e => { e.currentTarget.style.borderColor = '#EF9F27' }}
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
                background: '#111827',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: (!institutionName || !city || !adminName || !email || password.length < 8) ? 'not-allowed' : 'pointer',
                opacity: (!institutionName || !city || !adminName || !email || password.length < 8) ? 0.5 : 1,
                fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              Continue
            </button>
          </div>

          <button
            onClick={() => setStep(1)}
            style={{ marginTop: 16, background: 'none', border: 'none', fontSize: 13, color: '#4B5563', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Back
          </button>
        </div>
      )}

      {/* Step 3: Choose modules */}
      {step === 3 && (
        <div style={{ width: '100%', maxWidth: 500 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Choose your modules
          </h1>
          <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 24 }}>
            We have pre-selected the right modules for your institution type. Add or remove as needed.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {(['engage', 'assess', 'learn', 'train'] as ModuleKey[]).map(mod => {
              const active = selectedModules.includes(mod)
              const color = MODULE_COLORS[mod]
              return (
                <button
                  key={mod}
                  onClick={() => toggleModule(mod)}
                  style={{
                    background: '#fff',
                    border: active ? `2px solid ${color}` : '0.5px solid #E2DDD3',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: active ? `${color}18` : '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? color : '#D1CBC0' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: active ? '#111827' : '#4B5563', textTransform: 'capitalize' }}>
                        {mod}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {MODULE_DESCRIPTIONS[mod]}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? color : '#9CA3AF', flexShrink: 0, marginLeft: 12 }}>
                    GHS {MODULE_PRICES[mod]}/mo
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{
            background: '#fff',
            border: '0.5px solid #E2DDD3',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14, color: '#4B5563' }}>
              {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>
              GHS {totalPrice}/month
            </span>
          </div>

          <button
            onClick={() => setStep(4)}
            disabled={selectedModules.length === 0}
            style={{
              width: '100%',
              height: 48,
              background: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 500,
              cursor: selectedModules.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedModules.length === 0 ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            Continue
          </button>

          <button
            onClick={() => setStep(2)}
            style={{ marginTop: 12, background: 'none', border: 'none', fontSize: 13, color: '#4B5563', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            Back
          </button>
        </div>
      )}

      {/* Step 4: Summary + start trial */}
      {step === 4 && (
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Ready to start your free trial
          </h1>
          <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 28 }}>
            14 days free. No card required. Cancel any time before the trial ends.
          </p>

          <div style={{ background: '#fff', border: '0.5px solid #E2DDD3', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 4 }}>Institution</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 20 }}>{institutionName}</div>

            <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 10 }}>Modules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {selectedModules.map(mod => (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODULE_COLORS[mod] }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', textTransform: 'capitalize' }}>{mod}</span>
                  </div>
                  <span style={{ fontSize: 14, color: '#4B5563' }}>GHS {MODULE_PRICES[mod]}/mo</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '0.5px solid #E2DDD3', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>After your free trial</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>GHS {totalPrice}/month</div>
              </div>
              <div style={{
                background: '#E1F5EE',
                color: '#085041',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 6,
              }}>
                14 days free
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FDECEA',
              border: '1px solid #E05C4B',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 13,
              color: '#7A1A10',
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
              background: '#EF9F27',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            {loading ? 'Setting up your account...' : 'Start my free trial'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#4B5563' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#EF9F27', fontWeight: 500, textDecoration: 'none' }}>Sign in</a>
          </p>

          <button
            onClick={() => setStep(3)}
            style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', fontSize: 13, color: '#4B5563', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
