'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LearningPath, PathStep } from '@/lib/types'
import { IconDocument, IconLock, IconPlay, IconCheck } from '@/components/icons'
import { normalizeSteps } from '@/lib/train-paths'

const DEMO_PATH: LearningPath & { steps: (PathStep & { completed?: boolean; locked?: boolean })[] } = {
  id: 'lp1',
  institution_id: '00000000-0000-0000-0000-000000000001',
  creator_id: '00000000-0000-0000-0000-000000000002',
  title: 'New Employee Onboarding',
  description: 'Everything you need to get started at your new role.',
  category: 'Onboarding',
  is_mandatory: true,
  due_date: '2026-07-01',
  created_at: '2026-06-01T08:00:00Z',
  steps: [
    {
      id: 'st1',
      title: 'Welcome to the team',
      type: 'video',
      content: { youtube_id: 'dQw4w9WgXcQ', body: 'A warm welcome from our CEO.' },
      duration_minutes: 8,
      is_mandatory: true,
      completed: true,
      locked: false,
    },
    {
      id: 'st2',
      title: 'Company handbook',
      type: 'reading',
      content: {
        body: `Welcome to the team. This handbook covers our values, policies, and ways of working together.\n\nOur Values:\n1. Integrity: we do what we say and say what we do\n2. Excellence: we hold ourselves to high standards in everything\n3. Community: we invest in the people around us\n\nWorking Hours:\nOur standard working hours are 8am to 5pm Monday through Friday. Flexible arrangements may be agreed with your line manager.\n\nLeave Policy:\nAll staff are entitled to 21 days of annual leave per year. Leave requests should be submitted at least 2 weeks in advance.\n\nCode of Conduct:\nWe expect all staff to treat colleagues, clients, and partners with respect at all times. Any conduct that undermines this will be addressed through our disciplinary process.`,
        key_principle: 'Integrity, excellence, and community guide how we work together every day.',
        quick_check: {
          text: 'How many days of annual leave are all staff entitled to?',
          options: ['14 days', '21 days', '28 days', '30 days'],
          correct: 1,
        },
      },
      duration_minutes: 20,
      is_mandatory: true,
      completed: false,
      locked: false,
    },
    {
      id: 'st3',
      title: 'Policy acknowledgement',
      type: 'sign_off',
      content: { policy_text: 'I confirm that I have read and understood the Company Handbook, including the Code of Conduct, Leave Policy, and Working Hours Policy. I agree to abide by these policies as a condition of my employment.' },
      duration_minutes: 5,
      is_mandatory: true,
      completed: false,
      locked: false,
    },
    {
      id: 'st4',
      title: 'Onboarding quiz',
      type: 'quiz',
      content: {
        questions: [
          { text: 'How many days of annual leave are all staff entitled to?', options: ['14 days', '21 days', '28 days', '30 days'] },
          { text: 'What should you do if you witness conduct that violates the Code of Conduct?', options: ['Ignore it', 'Report to HR', 'Handle it yourself', 'Tell a colleague'] },
        ],
      },
      duration_minutes: 10,
      is_mandatory: true,
      completed: false,
      locked: false,
    },
    {
      id: 'st5',
      title: 'Department induction',
      type: 'assessment',
      content: { prompt: 'Describe your understanding of your key responsibilities in your role and how they contribute to your team\'s goals. Write at least 3 sentences.' },
      duration_minutes: 15,
      is_mandatory: true,
      completed: false,
      locked: true,
    },
  ],
}

const QUIZ_COLORS = ['#2E2886', '#1A8966', '#C23B2A', '#D97010']
const QUIZ_LABELS = ['A', 'B', 'C', 'D']
const BLUE = '#1052A3'

function StepTypeIcon({ type, color = 'currentColor', size = 14 }: { type: string; color?: string; size?: number }) {
  if (type === 'video') return <IconPlay size={size} color={color} />
  if (type === 'reading') return <IconDocument size={size} color={color} />
  if (type === 'quiz') return <span style={{ fontSize: 10, fontWeight: 700, color }}>QZ</span>
  if (type === 'sign_off') return <span style={{ fontSize: 10, fontWeight: 700, color }}>SG</span>
  if (type === 'assessment') return <span style={{ fontSize: 10, fontWeight: 700, color }}>AS</span>
  return <span style={{ fontSize: 10, fontWeight: 700, color }}>ST</span>
}

function daysUntil(dateStr: string) {
  const due = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Due today'
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`
  return `${diff} day${diff !== 1 ? 's' : ''} until due`
}

function StepProgressStrip({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i < current ? '#fff' : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </div>
  )
}

function StepBlueHeader({
  title,
  subtitle,
  stepIndex,
  totalSteps,
  onClose,
}: {
  title: string
  subtitle: string
  stepIndex: number
  totalSteps: number
  onClose: () => void
}) {
  return (
    <div style={{ background: BLUE, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
            {subtitle}
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{title}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <StepProgressStrip current={stepIndex + 1} total={totalSteps} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close step"
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function VideoStep({ content }: { content: Record<string, unknown> }) {
  const youtubeId = String(content.youtube_id ?? '').trim()
  if (!youtubeId) {
    return (
      <div style={{ background: 'var(--amber-light)', borderRadius: 10, padding: 20, fontSize: 14, color: '#9A5800', lineHeight: 1.6 }}>
        This video step has no video linked yet. Ask your training manager to add a YouTube video in the path builder.
        {(content.body as string) && <p style={{ marginTop: 12 }}>{content.body as string}</p>}
      </div>
    )
  }
  return (
    <div style={{ background: '#000', borderRadius: 10, aspectRatio: '16/9', overflow: 'hidden' }}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${youtubeId}`}
        style={{ border: 'none' }}
        allowFullScreen
        title="Training video"
      />
    </div>
  )
}

interface QuickCheck {
  text: string
  options: string[]
  correct?: number
}

function ReadingStep({
  content,
  onComplete,
}: {
  content: Record<string, unknown>
  onComplete: () => void
}) {
  const body = content.body as string
  const keyPrinciple = (content.key_principle as string) ?? 'Read carefully. The details in this section apply to your daily work.'
  const quickCheck = content.quick_check as QuickCheck | undefined
  const [selected, setSelected] = useState<number | null>(null)

  const canComplete = !quickCheck || selected !== null

  return (
    <div>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--near-black)', whiteSpace: 'pre-line', maxHeight: 240, overflowY: 'auto', padding: '4px 0', marginBottom: 16 }}>
        {body}
      </div>

      <div style={{ background: 'var(--blue-light)', borderLeft: `3px solid ${BLUE}`, borderRadius: '0 8px 8px 0', padding: '12px 14px', marginBottom: 18 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: BLUE, marginBottom: 6 }}>Key principle</p>
        <p style={{ fontSize: 13, color: '#0C3D6E', lineHeight: 1.6 }}>{keyPrinciple}</p>
      </div>

      {quickCheck && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mid-grey)', marginBottom: 10 }}>Quick check</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12, lineHeight: 1.5 }}>{quickCheck.text}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickCheck.options.map((opt, oi) => {
              const isSelected = selected === oi
              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => setSelected(oi)}
                  style={{
                    background: isSelected ? 'var(--blue-light)' : 'var(--white)',
                    boxShadow: isSelected ? `0 0 0 1.5px ${BLUE}` : 'var(--shadow-soft)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: 'inherit',
                    color: isSelected ? BLUE : 'var(--near-black)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: isSelected ? BLUE : QUIZ_COLORS[oi],
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {QUIZ_LABELS[oi]}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canComplete}
        onClick={onComplete}
        style={{
          background: canComplete ? BLUE : '#EDECE9',
          color: canComplete ? '#fff' : 'var(--mid-grey)',
          border: 'none',
          borderRadius: 8,
          padding: '13px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: canComplete ? 'pointer' : 'not-allowed',
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        Mark complete & continue →
      </button>
    </div>
  )
}

function QuizStep({
  content,
  stepIndex,
  totalSteps,
  onComplete,
}: {
  content: Record<string, unknown>
  stepIndex: number
  totalSteps: number
  onComplete: () => void
}) {
  const questions = content.questions as { text: string; options: string[] }[]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [confirmed, setConfirmed] = useState(false)

  const q = questions[questionIndex]
  const selected = answers[questionIndex]
  const isLast = questionIndex === questions.length - 1

  function confirm() {
    if (selected === undefined) return
    setConfirmed(true)
    setTimeout(() => {
      setConfirmed(false)
      if (isLast) {
        onComplete()
      } else {
        setQuestionIndex(p => p + 1)
      }
    }, isLast ? 600 : 300)
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 4 }}>
          Question {questionIndex + 1} of {questions.length}
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= questionIndex ? BLUE : 'var(--bg2)',
              }}
            />
          ))}
        </div>
      </div>

      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--near-black)', marginBottom: 14, lineHeight: 1.5 }}>
        {q.text}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {q.options.map((opt, oi) => {
          const isSelected = selected === oi
          return (
            <button
              key={oi}
              type="button"
              onClick={() => !confirmed && setAnswers(p => ({ ...p, [questionIndex]: oi }))}
              style={{
                background: isSelected ? 'var(--blue-light)' : 'var(--white)',
                boxShadow: isSelected ? `0 0 0 1.5px ${BLUE}` : 'var(--shadow-soft)',
                border: 'none',
                borderRadius: 10,
                padding: '13px 14px',
                fontSize: 14,
                textAlign: 'left',
                cursor: confirmed ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'inherit',
                color: isSelected ? BLUE : 'var(--near-black)',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              <span style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: isSelected ? BLUE : QUIZ_COLORS[oi],
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {QUIZ_LABELS[oi]}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={selected === undefined || confirmed}
        onClick={confirm}
        style={{
          background: selected !== undefined && !confirmed ? BLUE : '#EDECE9',
          color: selected !== undefined && !confirmed ? '#fff' : 'var(--mid-grey)',
          border: 'none',
          borderRadius: 8,
          padding: '13px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: selected !== undefined && !confirmed ? 'pointer' : 'not-allowed',
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        Confirm →
      </button>

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
        Training step {stepIndex + 1} of {totalSteps}
      </p>
    </div>
  )
}

function SignOffStep({ content, onComplete }: { content: Record<string, unknown>; onComplete: () => void }) {
  const [checked, setChecked] = useState(false)
  const [signature, setSignature] = useState('')
  const [signed, setSigned] = useState(false)

  return (
    <div>
      <div style={{ background: '#FEF0DC', borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.65, color: '#9A5800' }}>
        {content.policy_text as string}
      </div>
      {!signed ? (
        <>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--near-black)', marginBottom: 14, cursor: 'pointer', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: BLUE, flexShrink: 0 }}
            />
            I confirm I have read and understood this policy.
          </label>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', display: 'block', marginBottom: 6 }}>
              Type your full name as a digital signature
            </label>
            <input
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%',
                background: 'var(--bg2)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: "'Georgia', serif",
                color: 'var(--near-black)',
                fontStyle: 'italic',
              }}
            />
          </div>
          <button
            type="button"
            disabled={!checked || !signature.trim()}
            onClick={() => { setSigned(true); setTimeout(onComplete, 600) }}
            style={{
              background: checked && signature.trim() ? BLUE : '#EDECE9',
              color: checked && signature.trim() ? '#fff' : 'var(--mid-grey)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: checked && signature.trim() ? 'pointer' : 'not-allowed',
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            Sign off
          </button>
        </>
      ) : (
        <div style={{ background: 'var(--blue-light)', borderRadius: 8, padding: '16px', fontSize: 14, color: BLUE }}>
          Signed off by {signature}. Recorded at {new Date().toLocaleString('en-GH')}.
        </div>
      )}
    </div>
  )
}

function AssessmentStep({ content }: { content: Record<string, unknown> }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--near-black)', marginBottom: 14, lineHeight: 1.65 }}>
        {content.prompt as string}
      </div>
      {!submitted ? (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            placeholder="Write your response here..."
            style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => setSubmitted(true)}
            style={{
              background: text.trim() ? BLUE : '#EDECE9',
              color: text.trim() ? '#fff' : 'var(--mid-grey)',
              border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', width: '100%',
            }}
          >
            Submit assessment
          </button>
        </>
      ) : (
        <div style={{ background: 'var(--blue-light)', borderRadius: 8, padding: '16px', fontSize: 14, color: BLUE }}>
          Assessment submitted. Your manager will review and provide feedback.
        </div>
      )}
    </div>
  )
}

function CertificateScreen({ name, pathTitle }: { name: string; pathTitle: string }) {
  const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}`
  const date = new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: '32px 20px' }}>
      <div style={{
        background: 'var(--white)',
        border: `2px solid ${BLUE}`,
        borderRadius: 16,
        padding: '36px 24px',
        textAlign: 'center',
      }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: BLUE }}>
          <IconCheck size={24} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: BLUE, marginBottom: 16, textTransform: 'uppercase' }}>
          Certificate of completion
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 6 }}>has successfully completed</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: BLUE, marginBottom: 24 }}>{pathTitle}</div>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mid-grey)' }}>
          <span>{date}</span>
          <span>{certNumber}</span>
        </div>
      </div>

      <div style={{ marginTop: 24, background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--near-black)', marginBottom: 12 }}>How was this training?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <StarButton key={star} value={star} />
          ))}
        </div>
        <textarea
          placeholder="Any feedback for the training team? (optional)"
          rows={3}
          style={{ width: '100%', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />
        <button
          type="button"
          style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Send feedback
        </button>
      </div>
    </div>
  )
}

function StarButton({ value }: { value: number }) {
  const [rating, setRating] = useState(0)
  return (
    <button
      type="button"
      onClick={() => setRating(value)}
      style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: rating >= value ? '#D97010' : '#EDECE9', padding: 2 }}
    >
      ★
    </button>
  )
}

export default function EmployeeTrainPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [path, setPath] = useState(DEMO_PATH)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const { getCurrentUser } = await import('@/lib/auth')
      const user = getCurrentUser()
      setUserName(user.name)

      const { data, error } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('id', params.id)
        .single()
      if (!error && data) {
        setPath({ ...data, steps: normalizeSteps(data.steps) })
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const progress = path.steps.length > 0 ? Math.round((completed.size / path.steps.length) * 100) : 0
  const allDone = path.steps.length > 0 && completed.size === path.steps.length
  const active = path.steps.find(s => s.id === activeStep)
  const activeIndex = active ? path.steps.findIndex(s => s.id === active.id) : -1

  function markComplete(id: string) {
    setCompleted(p => new Set(Array.from(p).concat(id)))
    setActiveStep(null)
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Getting your training path...</div>
  }

  if (allDone) {
    return <CertificateScreen name={userName} pathTitle={path.title} />
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 40 }}>
      <div style={{ background: BLUE, padding: '28px 20px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {path.is_mandatory && (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 4 }}>
              Mandatory
            </span>
          )}
          {path.category && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
              {path.category}
            </span>
          )}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{path.title}</div>
        {path.due_date && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
            {daysUntil(path.due_date)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{progress}%</span>
        </div>
      </div>

      {active && (active.type === 'reading' || active.type === 'quiz') ? (
        <div style={{ background: 'var(--white)', margin: '12px 16px', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-soft)' }}>
          <StepBlueHeader
            title={active.title}
            subtitle={active.type === 'reading' ? 'Reading' : 'Quiz'}
            stepIndex={activeIndex}
            totalSteps={path.steps.length}
            onClose={() => setActiveStep(null)}
          />
          <div style={{ padding: '18px' }}>
            {active.type === 'reading' && (
              <ReadingStep content={active.content} onComplete={() => markComplete(active.id)} />
            )}
            {active.type === 'quiz' && (
              <QuizStep
                content={active.content}
                stepIndex={activeIndex}
                totalSteps={path.steps.length}
                onComplete={() => markComplete(active.id)}
              />
            )}
          </div>
        </div>
      ) : active && (
        <div style={{ background: 'var(--white)', margin: '12px 16px', borderRadius: 10, padding: '18px', boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 2, textTransform: 'capitalize' }}>
                {active.type.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>{active.title}</div>
            </div>
            <button type="button" onClick={() => setActiveStep(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mid-grey)', padding: 4 }}>×</button>
          </div>

          {active.type === 'video' && <VideoStep content={active.content} />}
          {active.type === 'sign_off' && <SignOffStep content={active.content} onComplete={() => markComplete(active.id)} />}
          {active.type === 'assessment' && <AssessmentStep content={active.content} />}

          {active.type === 'video' && !completed.has(active.id) && (
            <button
              type="button"
              onClick={() => markComplete(active.id)}
              style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20, width: '100%', fontFamily: 'inherit' }}
            >
              Mark complete
            </button>
          )}
        </div>
      )}

      <div style={{ padding: '4px 16px 32px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 10, marginTop: 8 }}>
          {path.steps.length} steps
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {path.steps.map((step) => {
            const isComplete = completed.has(step.id)
            const isLocked = (step as PathStep & { locked?: boolean }).locked && !isComplete
            const isActive = step.id === activeStep

            return (
              <button
                key={step.id}
                type="button"
                disabled={isLocked}
                onClick={() => setActiveStep(isActive ? null : step.id)}
                style={{
                  background: 'var(--white)',
                  boxShadow: isActive ? `0 0 0 1.5px ${BLUE}, 0 2px 8px rgba(16,82,163,.12)` : 'var(--shadow-soft)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '13px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.4 : 1,
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isComplete ? 'var(--blue-light)' : isActive ? BLUE : 'var(--bg2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  color: isComplete ? BLUE : isActive ? '#fff' : 'var(--near-black)',
                }}>
                  {isComplete ? (
                    <IconCheck size={14} color={BLUE} />
                  ) : isLocked ? (
                    <IconLock size={14} color="var(--mid-grey)" />
                  ) : (
                    <StepTypeIcon type={step.type} color={isActive ? '#fff' : 'var(--near-black)'} size={14} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isLocked ? 'var(--mid-grey)' : 'var(--near-black)' }}>{step.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 2, textTransform: 'capitalize' }}>
                    {step.type.replace('_', ' ')} · {step.duration_minutes} min
                  </div>
                </div>
                {step.is_mandatory && !isComplete && !isActive && (
                  <span style={{ fontSize: 10, color: '#C23B2A', background: '#FDECEA', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>Required</span>
                )}
                {isComplete && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, background: 'var(--blue-light)', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>Done</span>
                )}
                {isActive && !isComplete && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: BLUE, flexShrink: 0 }}>Start</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
