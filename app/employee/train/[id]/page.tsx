'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LearningPath, PathStep } from '@/lib/types'

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

const STEP_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📄',
  quiz: '✓',
  sign_off: '✍',
  assessment: '📊',
}

const QUIZ_COLORS = ['#36318F', '#2BA888', '#E05C4B', '#EF9F27']
const QUIZ_LABELS = ['A', 'B', 'C', 'D']

function daysUntil(dateStr: string) {
  const due = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Due today'
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`
  return `${diff} day${diff !== 1 ? 's' : ''} until due`
}

function VideoStep({ content }: { content: Record<string, unknown> }) {
  return (
    <div style={{ background: '#000', borderRadius: 10, aspectRatio: '16/9', overflow: 'hidden' }}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${content.youtube_id}`}
        style={{ border: 'none' }}
        allowFullScreen
        title="Training video"
      />
    </div>
  )
}

function ReadingStep({ content }: { content: Record<string, unknown> }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--near-black)', whiteSpace: 'pre-line', maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
      {content.body as string}
    </div>
  )
}

function QuizStep({ content, onComplete }: { content: Record<string, unknown>; onComplete: () => void }) {
  const questions = content.questions as { text: string; options: string[] }[]
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12 }}>
            {qi + 1}. {q.text}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))}
                style={{
                  background: answers[qi] === oi ? QUIZ_COLORS[oi] : 'var(--white)',
                  color: answers[qi] === oi ? '#fff' : 'var(--near-black)',
                  border: `0.5px solid ${answers[qi] === oi ? QUIZ_COLORS[oi] : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 10px',
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: submitted ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'inherit',
                  minHeight: 48,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: answers[qi] === oi ? 'rgba(255,255,255,0.25)' : QUIZ_COLORS[oi],
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
            ))}
          </div>
        </div>
      ))}
      {!submitted && Object.keys(answers).length === questions.length && (
        <button
          onClick={() => { setSubmitted(true); setTimeout(onComplete, 800) }}
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8, width: '100%', fontFamily: 'inherit' }}
        >
          Submit answers
        </button>
      )}
      {submitted && (
        <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#0B2E52', marginTop: 8 }}>
          Answers submitted. Your manager will review them.
        </div>
      )}
    </div>
  )
}

function SignOffStep({ content, onComplete }: { content: Record<string, unknown>; onComplete: () => void }) {
  const [checked, setChecked] = useState(false)
  const [signature, setSignature] = useState('')
  const [signed, setSigned] = useState(false)

  return (
    <div>
      <div style={{ background: '#FEF3DC', borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.65, color: '#633806' }}>
        {content.policy_text as string}
      </div>
      {!signed ? (
        <>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--near-black)', marginBottom: 14, cursor: 'pointer', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: '#185FA5', flexShrink: 0 }}
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
            disabled={!checked || !signature.trim()}
            onClick={() => { setSigned(true); setTimeout(onComplete, 600) }}
            style={{
              background: checked && signature.trim() ? '#185FA5' : '#E2DDD3',
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
        <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '16px', fontSize: 14, color: '#0B2E52' }}>
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
            disabled={!text.trim()}
            onClick={() => setSubmitted(true)}
            style={{
              background: text.trim() ? '#185FA5' : '#E2DDD3',
              color: text.trim() ? '#fff' : 'var(--mid-grey)',
              border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', width: '100%',
            }}
          >
            Submit assessment
          </button>
        </>
      ) : (
        <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '16px', fontSize: 14, color: '#0B2E52' }}>
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
        border: '2px solid #185FA5',
        borderRadius: 16,
        padding: '36px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#185FA5', marginBottom: 16, textTransform: 'uppercase' }}>
          Certificate of completion
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--near-black)', marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 6 }}>has successfully completed</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#185FA5', marginBottom: 24 }}>{pathTitle}</div>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mid-grey)' }}>
          <span>{date}</span>
          <span>{certNumber}</span>
        </div>
      </div>

      <div style={{ marginTop: 24, background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
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
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
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
      onClick={() => setRating(value)}
      style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: rating >= value ? '#EF9F27' : '#E2DDD3', padding: 2 }}
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
      if (!error && data) setPath(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  const progress = path.steps.length > 0 ? Math.round((completed.size / path.steps.length) * 100) : 0
  const allDone = path.steps.length > 0 && completed.size === path.steps.length
  const active = path.steps.find(s => s.id === activeStep)

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
      {/* Header */}
      <div style={{ background: '#185FA5', padding: '28px 20px 20px' }}>
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

      {/* Active step content */}
      {active && (
        <div style={{ background: 'var(--white)', margin: '12px 16px', borderRadius: 10, padding: '18px', border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 2, textTransform: 'capitalize' }}>
                {active.type.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>{active.title}</div>
            </div>
            <button onClick={() => setActiveStep(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mid-grey)', padding: 4 }}>×</button>
          </div>

          {active.type === 'video' && <VideoStep content={active.content} />}
          {active.type === 'reading' && <ReadingStep content={active.content} />}
          {active.type === 'quiz' && <QuizStep content={active.content} onComplete={() => markComplete(active.id)} />}
          {active.type === 'sign_off' && <SignOffStep content={active.content} onComplete={() => markComplete(active.id)} />}
          {active.type === 'assessment' && <AssessmentStep content={active.content} />}

          {(active.type === 'video' || active.type === 'reading') && !completed.has(active.id) && (
            <button
              onClick={() => markComplete(active.id)}
              style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20, width: '100%', fontFamily: 'inherit' }}
            >
              Mark complete
            </button>
          )}
        </div>
      )}

      {/* Step list */}
      <div style={{ padding: '4px 16px 32px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 10, marginTop: 8 }}>
          {path.steps.length} steps
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {path.steps.map((step, idx) => {
            const isComplete = completed.has(step.id)
            const isLocked = (step as PathStep & { locked?: boolean }).locked && !isComplete
            const isActive = step.id === activeStep

            return (
              <button
                key={step.id}
                disabled={isLocked}
                onClick={() => setActiveStep(isActive ? null : step.id)}
                style={{
                  background: isActive ? '#E6F1FB' : 'var(--white)',
                  border: `0.5px solid ${isActive ? '#185FA5' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.5 : 1,
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: isComplete ? '#185FA5' : 'var(--mid-grey)', width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: isComplete ? '#E6F1FB' : 'var(--bg2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isComplete ? 16 : 18, flexShrink: 0,
                  color: isComplete ? '#185FA5' : 'var(--near-black)',
                }}>
                  {isComplete ? '✓' : isLocked ? '🔒' : STEP_ICONS[step.type]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: isLocked ? 'var(--mid-grey)' : 'var(--near-black)' }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, textTransform: 'capitalize' }}>
                    {step.type.replace('_', ' ')} · {step.duration_minutes} min
                  </div>
                </div>
                {step.is_mandatory && !isComplete && (
                  <span style={{ fontSize: 10, color: '#7A1A10', background: '#FDECEA', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>Required</span>
                )}
                {isComplete && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#0B2E52', background: '#E6F1FB', padding: '2px 8px', borderRadius: 4 }}>Done</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
