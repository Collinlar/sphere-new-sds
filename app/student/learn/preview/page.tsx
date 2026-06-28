'use client'

import { useEffect, useState } from 'react'
import { Course, CourseModule } from '@/lib/types'

const MODULE_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📄',
  quiz: '✓',
  flashcards: '🃏',
  assignment: '📝',
}

const QUIZ_COLORS = ['#2E2886', '#1A8966', '#C23B2A', '#D97010']
const QUIZ_LABELS = ['A', 'B', 'C', 'D']

function VideoModule({ content }: { content: Record<string, unknown> }) {
  const videoUrl = (content.video_url as string) ?? ''
  const embedUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
    ? videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')
    : null

  return (
    <div>
      {embedUrl ? (
        <div style={{ background: '#000', borderRadius: 10, aspectRatio: '16/9', overflow: 'hidden', marginBottom: 12 }}>
          <iframe width="100%" height="100%" src={embedUrl} style={{ border: 'none' }} allowFullScreen title="Lesson video" />
        </div>
      ) : videoUrl ? (
        <div style={{ background: 'var(--page-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 6 }}>Video link</div>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: '#1052A3', wordBreak: 'break-all' }}>{videoUrl}</a>
        </div>
      ) : (
        <div style={{ background: 'var(--page-bg)', borderRadius: 10, padding: '32px', textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14, marginBottom: 12 }}>
          No video URL set for this module.
        </div>
      )}
    </div>
  )
}

function ReadingModule({ content }: { content: Record<string, unknown> }) {
  const body = content.body as string
  return (
    <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--near-black)', whiteSpace: 'pre-line', maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
      {body || <span style={{ color: 'var(--mid-grey)' }}>No reading content yet.</span>}
    </div>
  )
}

function QuizModule({ content }: { content: Record<string, unknown> }) {
  const questions = (content.questions as { question: string; options: string[]; correct: number }[]) ?? []
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  function submit() {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length
    setScore(Math.round((correct / questions.length) * 100))
    setSubmitted(true)
  }

  if (questions.length === 0) return <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>No questions added yet.</div>

  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--near-black)', marginBottom: 12 }}>{qi + 1}. {q.question}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {q.options.map((opt, oi) => {
              const isSelected = answers[qi] === oi
              const isCorrect = submitted && oi === q.correct
              const isWrong = submitted && isSelected && oi !== q.correct
              return (
                <button key={oi} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))}
                  style={{ background: isCorrect ? '#DDFAF0' : isWrong ? '#FDECEA' : isSelected ? QUIZ_COLORS[oi] : 'var(--white)', color: isSelected && !submitted ? '#fff' : 'var(--near-black)', border: `0.5px solid ${isCorrect ? '#1A8966' : isWrong ? '#C23B2A' : isSelected ? QUIZ_COLORS[oi] : 'var(--border)'}`, borderRadius: 10, padding: '14px 12px', fontSize: 14, fontWeight: 500, textAlign: 'left', cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', minHeight: 52 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: QUIZ_COLORS[oi], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{QUIZ_LABELS[oi]}</span>
                  {opt || <span style={{ color: 'var(--mid-grey)' }}>Option {QUIZ_LABELS[oi]}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {!submitted && Object.keys(answers).length === questions.length && (
        <button onClick={submit} style={{ background: '#1A8966', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
          Submit answers
        </button>
      )}
      {submitted && (
        <div style={{ background: score >= 70 ? '#DDFAF0' : '#FEF0DC', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: score >= 70 ? '#1A8966' : '#9A5800', marginTop: 8 }}>
          Score: {score}%. {score >= 70 ? 'Well done.' : 'Review the highlighted answers.'}
        </div>
      )}
    </div>
  )
}

function FlashcardsModule({ content }: { content: Record<string, unknown> }) {
  const cards = (content.cards as { front: string; back: string }[]) ?? []
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (cards.length === 0) return <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>No flashcards added yet.</div>

  return (
    <div>
      <div onClick={() => setFlipped(p => !p)} style={{ background: flipped ? '#2E2886' : '#1A8966', color: '#fff', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginBottom: 16, userSelect: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', marginBottom: 10, opacity: 0.75 }}>{flipped ? 'BACK' : 'FRONT'}</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{flipped ? cards[index].back : cards[index].front}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 14 }}>Tap to flip</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => { setIndex(p => Math.max(0, p - 1)); setFlipped(false) }} disabled={index === 0} style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', opacity: index === 0 ? 0.4 : 1 }}>Previous</button>
        <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>{index + 1} / {cards.length}</span>
        <button onClick={() => { setIndex(p => Math.min(cards.length - 1, p + 1)); setFlipped(false) }} disabled={index === cards.length - 1} style={{ background: '#1A8966', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: '#fff', fontFamily: 'inherit', opacity: index === cards.length - 1 ? 0.4 : 1 }}>Next</button>
      </div>
    </div>
  )
}

function AssignmentModule({ content }: { content: Record<string, unknown> }) {
  const [text, setText] = useState('')
  const instructions = (content.instructions as string) || (content.prompt as string) || ''

  return (
    <div>
      {instructions && <div style={{ fontSize: 14, color: 'var(--near-black)', marginBottom: 14, lineHeight: 1.65 }}>{instructions}</div>}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Write your response here..." style={{ width: '100%', background: 'var(--page-bg)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
      <div style={{ background: '#FEF0DC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#9A5800' }}>
        Preview mode: submissions are not saved.
      </div>
    </div>
  )
}

export default function CoursePreviewPage() {
  const [course, setCourse] = useState<Course | null>(null)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    const raw = sessionStorage.getItem('sphere_course_preview')
    if (raw) {
      try { setCourse(JSON.parse(raw)) } catch { /* invalid JSON */ }
    }
  }, [])

  if (!course) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--mid-grey)', fontSize: 14 }}>
        No preview data found. Open this page from the course builder.
      </div>
    )
  }

  const progress = course.modules.length > 0 ? Math.round((completed.size / course.modules.length) * 100) : 0
  const active = course.modules.find((m: CourseModule) => m.id === activeModule)

  function markComplete(id: string) {
    setCompleted(p => new Set([...p, id]))
    setActiveModule(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      {/* Preview banner */}
      <div style={{ background: '#0C1021', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#D97010', background: '#D9701020', padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase' }}>Preview mode</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>This is what your students will see. Progress is not saved.</span>
        </div>
        <button onClick={() => window.close()} style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Close preview
        </button>
      </div>

      {/* Student player */}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: course.thumbnail_color, padding: '28px 20px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: '0.06em' }}>
            {course.subject || 'Subject'} · {course.grade_level || 'Grade'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{course.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 3 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{progress}%</span>
          </div>
        </div>

        {/* Active module */}
        {active && (
          <div style={{ background: 'var(--white)', margin: '12px 16px', borderRadius: 10, padding: '18px', boxShadow: 'var(--shadow-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 2, textTransform: 'capitalize' }}>{active.type}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)' }}>{active.title}</div>
              </div>
              <button onClick={() => setActiveModule(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mid-grey)', padding: 4 }}>×</button>
            </div>

            {active.type === 'video' && <VideoModule content={active.content} />}
            {active.type === 'reading' && <ReadingModule content={active.content} />}
            {active.type === 'quiz' && <QuizModule content={active.content} />}
            {active.type === 'flashcards' && <FlashcardsModule content={active.content} />}
            {active.type === 'assignment' && <AssignmentModule content={active.content} />}

            {active.type !== 'quiz' && active.type !== 'assignment' && !completed.has(active.id) && (
              <button onClick={() => markComplete(active.id)} style={{ background: '#1A8966', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20, width: '100%', fontFamily: 'inherit' }}>
                Mark complete
              </button>
            )}
            {completed.has(active.id) && (
              <div style={{ marginTop: 16, background: '#DDFAF0', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#1A8966', textAlign: 'center' }}>
                Module complete
              </div>
            )}
          </div>
        )}

        {/* Module list */}
        <div style={{ padding: '4px 16px 48px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 10, marginTop: 8 }}>
            {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'}
          </div>
          {course.modules.length === 0 && (
            <div style={{ color: 'var(--mid-grey)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
              No modules added yet. Go back to the builder and add some.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {course.modules.map((mod: CourseModule, idx: number) => {
              const isComplete = completed.has(mod.id)
              const isActive = mod.id === activeModule
              return (
                <button key={mod.id} onClick={() => setActiveModule(isActive ? null : mod.id)}
                  style={{ background: isActive ? '#DDFAF0' : 'var(--white)', border: `0.5px solid ${isActive ? '#1A8966' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: isComplete ? '#1A8966' : 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isComplete ? 16 : 18, flexShrink: 0, color: isComplete ? '#fff' : 'var(--near-black)' }}>
                    {isComplete ? '✓' : MODULE_ICONS[mod.type]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)' }}>{idx + 1}. {mod.title || 'Untitled module'}</div>
                    <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, textTransform: 'capitalize' }}>{mod.type} · {mod.duration_minutes} min</div>
                  </div>
                  {isComplete && <span style={{ fontSize: 11, fontWeight: 500, color: '#1A8966', background: '#DDFAF0', padding: '2px 8px', borderRadius: 4 }}>Done</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
