'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getContentInstitutionId } from '@/lib/context'
import { canCreate, incrementUsed } from '@/lib/subscription'

interface GuideStep {
  title: string
  body: string
  tip: string
}

const COVER_COLORS = ['#1052A3', '#1A8966', '#D97010', '#2E2886', '#C23B2A']

export default function GuideBuilderPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0])
  const [estimatedMinutes, setEstimatedMinutes] = useState(15)
  const [steps, setSteps] = useState<GuideStep[]>([{ title: '', body: '', tip: '' }])
  const [activeStep, setActiveStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mobileTab, setMobileTab] = useState<'setup' | 'edit'>('setup')

  function updateStep(index: number, patch: Partial<GuideStep>) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function addStep() {
    setSteps(prev => [...prev, { title: '', body: '', tip: '' }])
    setActiveStep(steps.length)
    setMobileTab('edit')
  }

  function removeStep(index: number) {
    if (steps.length === 1) return
    setSteps(prev => prev.filter((_, i) => i !== index))
    setActiveStep(Math.max(0, index - 1))
  }

  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setActiveStep(target)
  }

  async function handleSave(publish: boolean) {
    if (!title.trim()) { setError('Give your guide a title first.'); return }
    if (steps.every(s => !s.title.trim() && !s.body.trim())) {
      setError('Add at least one step with content.')
      return
    }

    const gate = await canCreate('learn')
    if (!gate.allowed) { setError(gate.reason ?? 'You cannot create a guide right now.'); return }

    setSaving(true)
    setError('')

    const { error: saveError } = await supabase.from('guides').insert({
      creator_id: getCurrentUser().id,
      institution_id: getContentInstitutionId(),
      title: title.trim(),
      description: description.trim() || null,
      cover_color: coverColor,
      steps: steps.filter(s => s.title.trim() || s.body.trim()),
      estimated_minutes: estimatedMinutes,
      subject: subject.trim() || null,
      is_published: publish,
    })

    setSaving(false)

    if (saveError) {
      setError('Your guide did not save. Check your connection and try again.')
      return
    }

    await incrementUsed('learn')
    router.push('/learn')
  }

  const step = steps[activeStep]

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--white)',
    fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
    boxSizing: 'border-box', color: 'var(--near-black)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <style>{`
        .g-mobile-tabs { display: none; }
        @media (max-width: 768px) {
          .g-mobile-tabs { display: flex; height: 44px; background: var(--white); border-bottom: 0.5px solid var(--border); }
          .g-mobile-tab-btn { flex: 1; border: none; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
          .g-layout { grid-template-columns: 1fr !important; padding: 16px 16px 60px !important; }
          .g-left.tab-hidden, .g-right.tab-hidden { display: none !important; }
        }
      `}</style>
      <TopBar
        mode="learn"
        title="Guide builder"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSave(false)} disabled={saving} style={{
              height: 36, padding: '0 14px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--white)',
              fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Save draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} style={{
              height: 36, padding: '0 16px', borderRadius: 7, border: 'none',
              background: '#1A8966', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? 'Saving...' : 'Publish guide'}
            </button>
          </div>
        }
      />

      {/* Mobile tabs */}
      <div className="g-mobile-tabs">
        <button className="g-mobile-tab-btn" onClick={() => setMobileTab('setup')} style={{ color: mobileTab === 'setup' ? '#1A8966' : 'var(--mid-grey)', borderBottom: mobileTab === 'setup' ? '2px solid #1A8966' : '2px solid transparent' }}>
          Setup &amp; steps
        </button>
        <button className="g-mobile-tab-btn" onClick={() => setMobileTab('edit')} style={{ color: mobileTab === 'edit' ? '#1A8966' : 'var(--mid-grey)', borderBottom: mobileTab === 'edit' ? '2px solid #1A8966' : '2px solid transparent' }}>
          Edit step
        </button>
      </div>

      <div className="g-layout" style={{ padding: '28px 32px 60px', maxWidth: 980, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: guide meta + step list */}
        <div className={`g-left ${mobileTab === 'setup' ? '' : 'tab-hidden'}`}>
          <div className="sphere-card" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Guide title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you teaching?" style={{ ...inputStyle, marginBottom: 12 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Short description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="One or two lines about this guide" rows={2}
              style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', marginBottom: 12 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. ICT, Biology" style={{ ...inputStyle, marginBottom: 12 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Estimated time</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="number" min={1} value={estimatedMinutes} onChange={e => setEstimatedMinutes(parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, width: 80 }} />
              <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>minutes</span>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Cover colour</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {COVER_COLORS.map(c => (
                <button key={c} onClick={() => setCoverColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: coverColor === c ? '3px solid var(--near-black)' : '3px solid transparent',
                  cursor: 'pointer', padding: 0,
                }} aria-label={`Cover colour ${c}`} />
              ))}
            </div>
          </div>

          {/* Step list */}
          <div className="sphere-card">
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10 }}>Steps ({steps.length})</p>
            {steps.map((s, i) => (
              <button key={i} onClick={() => { setActiveStep(i); setMobileTab('edit') }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 7, border: 'none', marginBottom: 3,
                background: activeStep === i ? 'var(--bg2)' : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: activeStep === i ? coverColor : 'var(--bg2)',
                  color: activeStep === i ? '#fff' : 'var(--mid-grey)',
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--near-black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title.trim() || `Step ${i + 1}`}
                </span>
              </button>
            ))}
            <button onClick={addStep} style={{
              width: '100%', height: 34, borderRadius: 7, marginTop: 6,
              border: '1px dashed var(--border)', background: 'transparent',
              fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add step
            </button>
          </div>
        </div>

        {/* Right: active step editor */}
        <div className={`g-right sphere-card ${mobileTab === 'edit' ? '' : 'tab-hidden'}`}>
          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{error}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)' }}>Step {activeStep + 1}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => moveStep(activeStep, -1)} disabled={activeStep === 0} title="Move up"
                style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', color: 'var(--mid-grey)', fontFamily: 'inherit' }}>↑</button>
              <button onClick={() => moveStep(activeStep, 1)} disabled={activeStep === steps.length - 1} title="Move down"
                style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', color: 'var(--mid-grey)', fontFamily: 'inherit' }}>↓</button>
              {steps.length > 1 && (
                <button onClick={() => removeStep(activeStep)} title="Remove step"
                  style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid var(--coral-light)', background: 'var(--white)', cursor: 'pointer', color: 'var(--coral)', fontSize: 12, fontFamily: 'inherit' }}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Step title</label>
          <input value={step.title} onChange={e => updateStep(activeStep, { title: e.target.value })}
            placeholder="What happens in this step?" style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Step content</label>
          <textarea value={step.body} onChange={e => updateStep(activeStep, { body: e.target.value })}
            placeholder="Explain this step clearly. Learners will read this exactly as written."
            rows={8} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', marginBottom: 14, lineHeight: 1.6 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Tip (optional)</label>
          <input value={step.tip} onChange={e => updateStep(activeStep, { tip: e.target.value })}
            placeholder="A helpful hint shown alongside this step" style={inputStyle} />
        </div>
      </div>
    </div>
  )
}
