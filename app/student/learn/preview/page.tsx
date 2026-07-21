'use client'

import { useEffect, useState } from 'react'
import { LessonMediaPlaceholder, LessonStepFrame } from '@/components/brand/LessonStepFrame'
import { Course, CourseModule } from '@/lib/types'

const MODULE_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📄',
  quiz: '✓',
  flashcards: '🃏',
  assignment: '📝',
}

const QUIZ_LABELS = ['A', 'B', 'C', 'D']

function VideoModule({ content }: { content: Record<string, unknown> }) {
  const videoUrl = (content.video_url as string) ?? ''
  const embedUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
    ? videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')
    : null

  if (embedUrl) {
    return (
      <div style={{ background: '#000', borderRadius: 14, aspectRatio: '16/9', overflow: 'hidden' }}>
        <iframe width="100%" height="100%" src={embedUrl} style={{ border: 'none' }} allowFullScreen title="Lesson video" />
      </div>
    )
  }
  if (videoUrl) {
    return (
      <div style={{ background: '#0C1021', borderRadius: 14, padding: '14px 16px' }}>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: '#fff', wordBreak: 'break-all' }}>{videoUrl}</a>
      </div>
    )
  }
  return <LessonMediaPlaceholder label="[ video for this module ]" />
}

function ReadingModule({ content }: { content: Record<string, unknown> }) {
  return (
    <div style={{ whiteSpace: 'pre-line' }}>
      {(content.body as string) || <span style={{ color: 'var(--mid-grey)' }}>No reading content yet.</span>}
    </div>
  )
}

function QuizModule({ content, onSubmit }: { content: Record<string, unknown>; onSubmit: () => void }) {
  const questions = (content.questions as { question: string; options: string[]; correct: number }[]) ?? []
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  function submit() {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length
    setScore(Math.round((correct / questions.length) * 100))
    setSubmitted(true)
    onSubmit()
  }

  if (questions.length === 0) return <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>No questions added yet.</div>

  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 10, lineHeight: 1.45 }}>{qi + 1}. {q.question}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isSelected = answers[qi] === oi
              const isCorrect = submitted && oi === q.correct
              const isWrong = submitted && isSelected && oi !== q.correct
              return (
                <button key={oi} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))}
                  style={{
                    background: isCorrect ? '#DDFAF0' : isWrong ? '#FDECEA' : isSelected ? '#E1F5EE' : '#F9FAFB',
                    boxShadow: isCorrect ? '0 0 0 1.5px #1A8966' : isWrong ? '0 0 0 1.5px #C23B2A' : isSelected ? '0 0 0 1.5px #1A8966' : 'none',
                    border: 'none', borderRadius: 12, padding: '13px 16px', fontSize: 14, fontWeight: isSelected ? 600 : 400,
                    color: isCorrect ? '#1A8966' : isWrong ? '#C23B2A' : 'var(--near-black)',
                    textAlign: 'left', cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
                  }}>
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: isCorrect ? '#1A8966' : isWrong ? '#C23B2A' : isSelected ? '#1A8966' : '#E5E7EB', color: isSelected || isCorrect || isWrong ? '#fff' : '#6B7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{QUIZ_LABELS[oi]}</span>
                  {opt || <span style={{ color: 'var(--mid-grey)' }}>Option {QUIZ_LABELS[oi]}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {!submitted && Object.keys(answers).length === questions.length && (
        <button onClick={submit} style={{ background: '#1A8966', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: 'inherit', width: '100%', minHeight: 48 }}>
          Submit answers
        </button>
      )}
      {submitted && (
        <div style={{ background: score >= 70 ? '#DDFAF0' : '#FEF0DC', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: score >= 70 ? '#1A8966' : '#9A5800', marginTop: 8 }}>
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
      <div onClick={() => setFlipped(p => !p)} style={{ background: flipped ? '#2E2886' : '#1A8966', color: '#fff', borderRadius: 14, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginBottom: 16, userSelect: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', marginBottom: 10, opacity: 0.75 }}>{flipped ? 'BACK' : 'FRONT'}</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{flipped ? cards[index].back : cards[index].front}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 14 }}>Tap to flip</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={() => { setIndex(p => Math.max(0, p - 1)); setFlipped(false) }} disabled={index === 0} style={{ flex: 1, minHeight: 44, background: '#fff', border: '0.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', opacity: index === 0 ? 0.4 : 1 }}>Previous card</button>
        <span style={{ fontSize: 13, color: 'var(--mid-grey)', flexShrink: 0 }}>{index + 1} / {cards.length}</span>
        <button onClick={() => { setIndex(p => Math.min(cards.length - 1, p + 1)); setFlipped(false) }} disabled={index === cards.length - 1} style={{ flex: 1, minHeight: 44, background: '#1A8966', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: '#fff', fontFamily: 'inherit', opacity: index === cards.length - 1 ? 0.4 : 1 }}>Next card</button>
      </div>
    </div>
  )
}

function AssignmentModule({ content }: { content: Record<string, unknown> }) {
  const [text, setText] = useState('')
  const instructions = (content.instructions as string) || (content.prompt as string) || ''

  return (
    <div>
      {instructions && <p style={{ fontSize: 15, color: 'var(--near-black)', marginBottom: 14, lineHeight: 1.65 }}>{instructions}</p>}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Write your response here..." style={{ width: '100%', background: '#F7F4ED', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
      <div style={{ background: '#FEF0DC', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#9A5800' }}>
        Preview mode: submissions are not saved.
      </div>
    </div>
  )
}

function moduleMetaLine(course: Course, mod: CourseModule) {
  const mins = mod.duration_minutes
  const unit = mod.type === 'video' ? 'min watch' : mod.type === 'quiz' ? 'min quiz' : mod.type === 'assignment' ? 'min task' : 'min read'
  const subject = course.subject || course.title
  return mins ? `${subject}, ${mins} ${unit}` : subject
}

function moduleRemember(mod: CourseModule, quizFollows: boolean) {
  const tip = (mod.content?.tip as string | undefined) || (mod.content?.remember as string | undefined)
  if (tip?.trim()) return tip.trim()
  if (quizFollows) return 'A short quiz follows this module. Take notes as you go.'
  return null
}

function ModuleMedia({ mod }: { mod: CourseModule }) {
  if (mod.type === 'video') return <VideoModule content={mod.content} />
  const imageUrl = (mod.content?.image_url as string | undefined) || (mod.content?.diagram_url as string | undefined)
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: 14, display: 'block' }} />
    )
  }
  return null
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
  const activeIdx = activeModule ? course.modules.findIndex((m) => m.id === activeModule) : -1
  const active = activeIdx >= 0 ? course.modules[activeIdx] : null
  const nextModule = activeIdx >= 0 ? course.modules[activeIdx + 1] : undefined
  const prevModule = activeIdx > 0 ? course.modules[activeIdx - 1] : undefined
  const quizFollows = activeIdx >= 0 && course.modules[activeIdx + 1]?.type === 'quiz'
  const isActiveComplete = active ? completed.has(active.id) : false

  function markComplete(id: string) {
    setCompleted(p => new Set([...p, id]))
    const idx = course!.modules.findIndex((m) => m.id === id)
    const next = idx >= 0 ? course!.modules[idx + 1] : undefined
    setActiveModule(next?.id ?? null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4ED' }}>
      <div style={{ background: '#0C1021', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#D97010', background: '#D9701020', padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase', flexShrink: 0 }}>Preview mode</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>What students see. Progress is not saved.</span>
        </div>
        <button onClick={() => window.close()} style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 14px', minHeight: 44, fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Close preview
        </button>
      </div>

      {active ? (
        (() => {
          const needsOwnSubmit = active.type === 'quiz' || active.type === 'assignment'
          let primaryLabel: string | undefined
          let onPrimary: (() => void) | undefined

          if (!needsOwnSubmit && !isActiveComplete) {
            primaryLabel = nextModule ? 'Continue to next step' : 'Mark complete'
            onPrimary = () => markComplete(active.id)
          } else if (isActiveComplete && nextModule) {
            primaryLabel = 'Continue to next step'
            onPrimary = () => setActiveModule(nextModule.id)
          } else if (isActiveComplete && !nextModule) {
            primaryLabel = 'Back to outline'
            onPrimary = () => setActiveModule(null)
          } else if (active.type === 'assignment' && !isActiveComplete) {
            primaryLabel = nextModule ? 'Continue to next step' : 'Mark complete'
            onPrimary = () => markComplete(active.id)
          }

          return (
            <LessonStepFrame
              subject={course.subject || 'Course'}
              stepIndex={activeIdx}
              stepCount={course.modules.length}
              title={active.title || 'Untitled module'}
              meta={moduleMetaLine(course, active)}
              media={<ModuleMedia mod={active} />}
              remember={moduleRemember(active, !!quizFollows)}
              primaryLabel={primaryLabel}
              onPrimary={onPrimary}
              tertiaryLabel={prevModule ? 'Previous step' : undefined}
              onTertiary={prevModule ? () => setActiveModule(prevModule.id) : undefined}
              onSecondary={() => setActiveModule(null)}
              secondaryLabel="Back to outline"
            >
              {active.type === 'reading' && <ReadingModule content={active.content} />}
              {active.type === 'video' && (
                <p style={{ margin: 0, color: '#4B5563', fontSize: 15 }}>
                  Watch the lesson above, then continue when you are ready.
                </p>
              )}
              {active.type === 'quiz' && <QuizModule content={active.content} onSubmit={() => markComplete(active.id)} />}
              {active.type === 'flashcards' && <FlashcardsModule content={active.content} />}
              {active.type === 'assignment' && <AssignmentModule content={active.content} />}
            </LessonStepFrame>
          )
        })()
      ) : (
        <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div style={{ background: course.thumbnail_color, padding: '28px 20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: '0.06em' }}>
              {course.subject || 'Subject'} · {course.grade_level || 'Grade'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16, lineHeight: 1.25 }}>{course.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 999 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{progress}%</span>
            </div>
          </div>

          <div style={{ padding: '16px 16px 40px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 12 }}>
              {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'}
            </p>

            {course.modules.length === 0 && (
              <div style={{ color: 'var(--mid-grey)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                No modules added yet. Go back to the builder and add some.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {course.modules.map((mod: CourseModule, idx: number) => {
                const isComplete = completed.has(mod.id)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActiveModule(mod.id)}
                    style={{
                      width: '100%', minHeight: 64, padding: '14px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      cursor: 'pointer', fontFamily: 'inherit', background: '#fff', border: 'none',
                      borderRadius: 14, boxShadow: '0 4px 16px rgba(17, 24, 39, 0.04)',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: isComplete ? '#1A8966' : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isComplete ? 16 : 18, flexShrink: 0,
                      color: isComplete ? '#fff' : 'var(--near-black)',
                    }}>
                      {isComplete ? '✓' : MODULE_ICONS[mod.type]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.3 }}>
                        {idx + 1}. {mod.title || 'Untitled module'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 3, textTransform: 'capitalize' }}>
                        {mod.type} · {mod.duration_minutes} min
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                      color: isComplete ? '#1A8966' : 'var(--mid-grey)',
                      background: isComplete ? '#DDFAF0' : 'transparent',
                      padding: '4px 10px', borderRadius: 20,
                    }}>
                      {isComplete ? 'Done' : 'Start'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
