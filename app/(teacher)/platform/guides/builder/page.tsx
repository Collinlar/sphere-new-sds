'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { fetchGuideById, updateGuide } from '@/lib/content-resources'
import type { GuideStep } from '@/lib/types'

function emptyStep(): GuideStep {
  return { id: crypto.randomUUID(), title: '', body: '', tip: '' }
}

function GuideBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const guideId = searchParams.get('id')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [steps, setSteps] = useState<GuideStep[]>([emptyStep()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!guideId) {
      setLoading(false)
      return
    }
    fetchGuideById(guideId).then((guide) => {
      if (!guide) {
        setError('Guide not found.')
        setLoading(false)
        return
      }
      setTitle(guide.title)
      setDescription(guide.description ?? '')
      setSubject(guide.subject ?? '')
      setGradeLevel(guide.grade_level ?? '')
      setSteps(guide.steps?.length ? guide.steps : [emptyStep()])
      setLoading(false)
    })
  }, [guideId])

  async function save(publish: boolean) {
    if (!guideId || !title.trim()) {
      setError('Give your guide a title first.')
      return
    }
    setSaving(true)
    setError('')
    const result = await updateGuide(guideId, {
      title: title.trim(),
      description: description.trim(),
      subject: subject || undefined,
      grade_level: gradeLevel || undefined,
      steps: steps.filter((s) => s.title.trim() || s.body.trim()),
      estimated_minutes: Math.max(steps.length * 5, 5),
      is_published: publish,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/platform/library')
  }

  if (loading) {
    return <p style={{ padding: 28, color: 'var(--mid-grey)' }}>Loading guide...</p>
  }

  if (!guideId) {
    return (
      <div style={{ padding: 28 }}>
        <p style={{ color: 'var(--coral)', marginBottom: 12 }}>No guide selected.</p>
        <Link href="/platform/library" style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}>Back to library</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="platform"
        title="Guide builder"
        left={
          <Link href="/platform/library" style={{ fontSize: 13, color: 'var(--mid-grey)', textDecoration: 'none' }}>
            ← Library
          </Link>
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => save(false)} disabled={saving} style={btnSecondary}>{saving ? 'Saving...' : 'Save draft'}</button>
            <button onClick={() => save(true)} disabled={saving} style={btnPrimary}>Publish guide</button>
          </div>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 760 }}>
        {error && <p style={{ color: 'var(--coral)', marginBottom: 12, fontSize: 13 }}>{error}</p>}

        <div className="sphere-card" style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Guide title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 14 }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} placeholder="Biology" />
            </div>
            <div>
              <label style={labelStyle}>Level</label>
              <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} style={inputStyle} placeholder="JHS 2" />
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10 }}>Steps ({steps.length})</p>
        {steps.map((step, index) => (
          <div key={step.id} className="sphere-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1052A3' }}>Step {index + 1}</span>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSteps((prev) => prev.filter((s) => s.id !== step.id))}
                  style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={step.title}
              onChange={(e) => setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, title: e.target.value } : s)))}
              placeholder="Step title"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <textarea
              value={step.body}
              onChange={(e) => setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, body: e.target.value } : s)))}
              placeholder="What should the reader do or understand here?"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
            />
            <input
              value={step.tip ?? ''}
              onChange={(e) => setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, tip: e.target.value } : s)))}
              placeholder="Optional tip"
              style={inputStyle}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setSteps((prev) => [...prev, emptyStep()])}
          style={{ ...btnSecondary, marginTop: 4 }}
        >
          Add step
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--mid-grey)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg2)',
  borderRadius: 8,
  padding: '0 14px',
  border: '1px solid transparent',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  background: '#1052A3',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: '0.5px solid var(--border)',
  background: 'var(--white)',
  color: 'var(--near-black)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function GuideBuilderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />}>
      <GuideBuilderInner />
    </Suspense>
  )
}
