'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { autoClaimBrowserSessions } from '@/lib/guest-sessions'

// Level categories users can choose from at signup.
// Drives marketplace personalisation — not a hard role assignment.
const LEVEL_CATEGORIES = [
  {
    id: 'school_student',
    label: 'School student',
    accent: '#1A8966',
    levels: [
      { id: 'p1', label: 'Primary 1' }, { id: 'p2', label: 'Primary 2' }, { id: 'p3', label: 'Primary 3' },
      { id: 'p4', label: 'Primary 4' }, { id: 'p5', label: 'Primary 5' }, { id: 'p6', label: 'Primary 6' },
      { id: 'jhs1', label: 'JHS 1' }, { id: 'jhs2', label: 'JHS 2' }, { id: 'jhs3', label: 'JHS 3' },
      { id: 'shs1', label: 'SHS 1' }, { id: 'shs2', label: 'SHS 2' }, { id: 'shs3', label: 'SHS 3' },
    ],
  },
  {
    id: 'university_student',
    label: 'University or college student',
    accent: '#2E2886',
    levels: [
      { id: 'yr1', label: 'Year 1 / Level 100' }, { id: 'yr2', label: 'Year 2 / Level 200' },
      { id: 'yr3', label: 'Year 3 / Level 300' }, { id: 'yr4', label: 'Year 4 / Level 400' },
      { id: 'postgrad', label: 'Postgraduate' },
    ],
  },
  {
    id: 'professional',
    label: 'Working professional',
    accent: '#1052A3',
    levels: [
      { id: 'entry', label: 'Early career (0 – 3 years)' },
      { id: 'mid', label: 'Mid-level (4 – 8 years)' },
      { id: 'senior', label: 'Senior (8+ years)' },
    ],
  },
  {
    id: 'educator',
    label: 'Teacher or trainer',
    accent: '#D97010',
    levels: [
      { id: 'teach_primary', label: 'Primary school' },
      { id: 'teach_jhs', label: 'Junior high school' },
      { id: 'teach_shs', label: 'Senior high school' },
      { id: 'teach_tertiary', label: 'Tertiary institution' },
      { id: 'teach_corporate', label: 'Corporate training' },
    ],
  },
  {
    id: 'self_learner',
    label: 'Self-directed learner',
    accent: '#C23B2A',
    levels: [
      { id: 'curious', label: 'Learning for interest' },
      { id: 'skill_build', label: 'Building a specific skill' },
      { id: 'career_change', label: 'Changing careers' },
    ],
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const category = LEVEL_CATEGORIES.find(c => c.id === selectedCategory)

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })

      if (authError || !authData.user) {
        setError(authError?.message ?? 'Could not create your account. Check your details and try again.')
        setLoading(false)
        return
      }

      const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        name,
        email,
        role: 'student',
        avatar_initials: initials,
        subscription_tier: 'membership',
        user_level: selectedLevel,
        level_type: selectedCategory,
      })

      if (userError) {
        console.error('users insert error:', userError)
        setError(`Your profile did not save: ${userError.message}`)
        setLoading(false)
        return
      }

      // Initialise membership creation quota
      await supabase.from('creation_usage').insert({
        user_id: authData.user.id,
        assess_quota: 5,
        engage_quota: 5,
        learn_quota: 0,
        train_quota: 0,
      })

      const userRecord = {
        id: authData.user.id,
        name,
        email,
        role: 'student',
        avatar_initials: initials,
        subscription_tier: 'membership',
        user_level: selectedLevel,
        level_type: selectedCategory,
      }

      localStorage.setItem('sphere_user', JSON.stringify(userRecord))

      // Auto-claim any guest sessions from this browser
      await autoClaimBrowserSessions(authData.user.id)

      router.push('/student/learn')
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

  const canProceedStep1 = name.trim().length > 1 && email.includes('@') && password.length >= 8

  return (
    <div style={{
      minHeight: '100vh',
      background: '#D5D4D1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: step === 2 && !selectedCategory ? 520 : 400,
        background: 'var(--page-bg)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card)',
        padding: '44px 36px 44px',
        transition: 'max-width 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--near-black)' }}>
            Sphere<span style={{ color: 'var(--amber)' }}>SDS</span>
          </span>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? 28 : 7,
                height: 7,
                borderRadius: s === step ? 4 : '50%',
                background: s === step ? 'var(--amber)' : s < step ? 'var(--near-black)' : 'var(--bg2)',
                transition: 'all 0.2s',
              }} />
            ))}
          </div>
        </div>

        {/* Step 1 — Account details */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 5 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 24 }}>
              Free to join. No card required.
            </p>

            <div style={{ background: 'var(--white)', borderRadius: 12, padding: '22px 20px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                  Your full name
                </label>
                <input
                  type="text"
                  placeholder="What's your name?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="8 characters or more"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                />
              </div>

              <button
                onClick={() => canProceedStep1 && setStep(2)}
                disabled={!canProceedStep1}
                style={{
                  height: 48,
                  background: 'var(--amber)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: canProceedStep1 ? 'pointer' : 'not-allowed',
                  opacity: canProceedStep1 ? 1 : 0.5,
                  fontFamily: 'inherit',
                  marginTop: 4,
                }}
              >
                Continue
              </button>
            </div>

            <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--mid-grey)' }}>
              Setting up for an institution?{' '}
              <a href="/onboarding" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
                Onboard here
              </a>
            </p>
            <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: 'var(--mid-grey)' }}>
              Already have an account?{' '}
              <a href="/login" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </a>
            </p>
          </>
        )}

        {/* Step 2 — Level selection */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', letterSpacing: '-0.02em', marginBottom: 5 }}>
              {!selectedCategory ? 'What best describes you?' : 'Pick your level'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 22 }}>
              {!selectedCategory
                ? 'This helps us show you the most relevant resources in the marketplace.'
                : 'We will personalise your experience based on this.'}
            </p>

            {/* Category selection */}
            {!selectedCategory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {LEVEL_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      background: 'var(--white)',
                      border: 'none',
                      borderLeft: `3px solid ${cat.accent}`,
                      borderRadius: 10,
                      padding: '14px 16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: 'var(--shadow-soft)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--near-black)',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 14px ${cat.accent}29, 0 0 0 1.5px ${cat.accent}` }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-soft)' }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Level selection within category */}
            {selectedCategory && category && (
              <>
                <button
                  onClick={() => { setSelectedCategory(null); setSelectedLevel(null) }}
                  style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 14 }}
                >
                  ← Back
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                  {category.levels.map(lv => {
                    const selected = selectedLevel === lv.id
                    return (
                      <button
                        key={lv.id}
                        onClick={() => setSelectedLevel(lv.id)}
                        style={{
                          height: 36,
                          padding: '0 16px',
                          borderRadius: 20,
                          border: 'none',
                          background: selected ? category.accent : 'var(--white)',
                          color: selected ? '#fff' : 'var(--near-black)',
                          fontSize: 13,
                          fontWeight: selected ? 600 : 400,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          boxShadow: selected ? 'none' : 'var(--shadow-soft)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {lv.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {error && (
              <div style={{ background: 'var(--coral-light)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--coral)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {selectedLevel && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 48,
                    background: 'var(--amber)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {loading ? 'Creating your account...' : 'Get started'}
                </button>
              )}
              {!selectedLevel && !selectedCategory && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 44,
                    background: 'transparent',
                    color: 'var(--mid-grey)',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {loading ? 'Creating your account...' : 'Skip for now'}
                </button>
              )}
            </div>

            <button
              onClick={() => setStep(1)}
              style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
