'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
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

  return (
    <div>
      {embedUrl ? (
        <div style={{ background: '#000', borderRadius: 10, aspectRatio: '16/9', overflow: 'hidden', marginBottom: 12 }}>
          <iframe width="100%" height="100%" src={embedUrl} style={{ border: 'none' }} allowFullScreen title="Lesson video" />
        </div>
      ) : videoUrl ? (
        <div style={{ background: '#0C1021', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Video link</div>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: '#fff', wordBreak: 'break-all' }}>{videoUrl}</a>
        </div>
      ) : (
        <div style={{ background: '#0C1021', borderRadius: 10, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polygon points="9,5 20,12 9,19" fill="rgba(255,255,255,0.5)" /></svg>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No video attached to this module.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadingModule({ content }: { content: Record<string, unknown> }) {
  return (
    <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--near-black)', whiteSpace: 'pre-line', maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
      {(content.body as string) || <span style={{ color: 'var(--mid-grey)' }}>No content yet.</span>}
    </div>
  )
}

function QuizModule({ content, onSubmit }: { content: Record<string, unknown>; onSubmit: (score: number) => void }) {
  const questions = (content.questions as { question: string; options: string[]; correct: number }[]) ?? []
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  function submit() {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length
    const pct = Math.round((correct / questions.length) * 100)
    setScore(pct)
    setSubmitted(true)
    onSubmit(pct)
  }

  if (questions.length === 0) {
    return <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>No questions added to this quiz yet.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--teal)' }}>Knowledge check</span>
      </div>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 20 }}>
          <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 12, padding: '16px 16px', marginBottom: 10 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', lineHeight: 1.5 }}>{qi + 1}. {q.question}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isSelected = answers[qi] === oi
              const isCorrect = submitted && oi === q.correct
              const isWrong = submitted && isSelected && oi !== q.correct
              return (
                <button key={oi} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))}
                  style={{
                    background: isCorrect ? '#DDFAF0' : isWrong ? '#FDECEA' : isSelected ? 'var(--teal-light)' : '#fff',
                    boxShadow: isCorrect ? '0 0 0 1.5px #1A8966' : isWrong ? '0 0 0 1.5px #C23B2A' : isSelected ? '0 0 0 1.5px var(--teal)' : 'var(--shadow-soft)',
                    border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 14, fontWeight: isSelected ? 600 : 400,
                    color: isCorrect ? '#1A8966' : isWrong ? '#C23B2A' : isSelected ? 'var(--teal)' : 'var(--near-black)',
                    textAlign: 'left', cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
                  }}>
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: isCorrect ? '#1A8966' : isWrong ? '#C23B2A' : isSelected ? 'var(--teal)' : 'var(--bg2)', color: isSelected || isCorrect || isWrong ? '#fff' : 'var(--mid-grey)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{QUIZ_LABELS[oi]}</span>
                  {opt}
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
          You scored {score}%. {score >= 70 ? 'Well done.' : 'Review the highlighted answers and try again next time.'}
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

function AssignmentModule({ content, moduleId, enrollmentId, onSubmit }: { content: Record<string, unknown>; moduleId: string; enrollmentId: string; onSubmit: () => void }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    await supabase.from('assignment_submissions').upsert({
      enrollment_id: enrollmentId,
      module_id: moduleId,
      response: text.trim(),
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'enrollment_id,module_id' })
    setSaving(false)
    setSubmitted(true)
    onSubmit()
  }

  const instructions = (content.instructions as string) || (content.prompt as string) || ''
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length

  return (
    <div>
      {instructions && (
        <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Brief</p>
          <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.6 }}>{instructions}</p>
        </div>
      )}
      {!submitted ? (
        <>
          <div style={{ background: '#fff', boxShadow: 'var(--shadow-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              placeholder="Write your response here..."
              style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 16px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.75, color: 'var(--near-black)' }}
            />
            <div style={{ borderTop: '0.5px solid var(--bg2)', padding: '8px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button disabled={!text.trim() || saving} onClick={submit} style={{ width: '100%', background: text.trim() ? '#1A8966' : 'var(--bg2)', color: text.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 14, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {saving ? 'Submitting...' : 'Submit assignment'}
          </button>
        </>
      ) : (
        <div style={{ background: '#DDFAF0', borderRadius: 8, padding: '16px', fontSize: 14, color: '#1A8966' }}>
          Assignment submitted. Your teacher will review and grade it.
        </div>
      )}
    </div>
  )
}

export default function StudentCoursePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const userId = getCurrentUser()?.id

  useEffect(() => {
    async function load() {
      const [courseRes, enrollRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', params.id).single(),
        userId ? supabase.from('enrollments').select('id, completed_modules').eq('course_id', params.id).eq('student_id', userId).single() : Promise.resolve({ data: null, error: null }),
      ])
      if (courseRes.data) setCourse(courseRes.data)
      if (enrollRes.data) {
        setEnrollmentId(enrollRes.data.id)
        setCompleted(new Set(enrollRes.data.completed_modules ?? []))
      }
      setLoading(false)
    }
    load()
  }, [params.id, userId])

  const persistProgress = useCallback(async (nextCompleted: Set<string>, modules: CourseModule[]) => {
    if (!enrollmentId) return
    const progress = modules.length > 0 ? Math.round((nextCompleted.size / modules.length) * 100) : 0
    await supabase.from('enrollments').update({
      completed_modules: Array.from(nextCompleted),
      progress_percentage: progress,
      ...(progress === 100 ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', enrollmentId)
  }, [enrollmentId])

  function markComplete(id: string) {
    const next = new Set(Array.from(completed).concat(id))
    setCompleted(next)
    setActiveModule(null)
    if (course) persistProgress(next, course.modules)
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your course...</div>
  if (!course) return <div style={{ padding: 24, color: '#C23B2A', fontSize: 14 }}>Course not found.</div>

  const progress = course.modules.length > 0 ? Math.round((completed.size / course.modules.length) * 100) : 0
  const active = course.modules.find((m: CourseModule) => m.id === activeModule)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--page-bg)' }}>
      {/* Header */}
      <div style={{ background: course.thumbnail_color, padding: '28px 20px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: '0.06em' }}>
          {course.subject} · {course.grade_level}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{course.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{completed.size} of {course.modules.length}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{progress}%</span>
        </div>
      </div>

      {/* Active module content */}
      {active && (() => {
        const activeIdx = course.modules.findIndex((m: CourseModule) => m.id === active.id)
        const prevModule = activeIdx > 0 ? course.modules[activeIdx - 1] : null
        const nextModule = activeIdx < course.modules.length - 1 ? course.modules[activeIdx + 1] : null
        const quizFollows = nextModule?.type === 'quiz'

        return (
          <div style={{ background: 'var(--white)', margin: '12px 16px', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-soft)' }}>
            <div style={{ background: course.thumbnail_color, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setActiveModule(null)} style={{ background: 'none', border: 'none', fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>‹</button>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{course.subject} · {active.title}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Lesson {activeIdx + 1} of {course.modules.length}</p>
              </div>
            </div>

            <div style={{ padding: '18px' }}>
              {active.type === 'video' && <VideoModule content={active.content} />}
              {active.type === 'reading' && <ReadingModule content={active.content} />}
              {active.type === 'quiz' && <QuizModule content={active.content} onSubmit={() => markComplete(active.id)} />}
              {active.type === 'flashcards' && <FlashcardsModule content={active.content} />}
              {active.type === 'assignment' && enrollmentId && (
                <AssignmentModule content={active.content} moduleId={active.id} enrollmentId={enrollmentId} onSubmit={() => markComplete(active.id)} />
              )}

              {quizFollows && (
                <div style={{ background: 'var(--teal-light)', borderRadius: 10, padding: '12px 14px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 13 }}>!</div>
                  <p style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>A short quiz follows this lesson. Take notes as you watch.</p>
                </div>
              )}

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

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => prevModule && setActiveModule(prevModule.id)}
                  disabled={!prevModule}
                  style={{ flex: 1, height: 44, background: 'var(--bg2)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, color: prevModule ? 'var(--mid-grey)' : '#D1CBC0', cursor: prevModule ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  ‹ Previous
                </button>
                <button
                  onClick={() => nextModule && setActiveModule(nextModule.id)}
                  disabled={!nextModule}
                  style={{ flex: 2, height: 44, background: nextModule ? course.thumbnail_color : 'var(--bg2)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: nextModule ? '#fff' : '#D1CBC0', cursor: nextModule ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  {nextModule ? 'Next lesson →' : 'Last lesson'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Module list */}
      <div style={{ padding: '16px 16px 32px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase', paddingLeft: 4 }}>
          {course.modules.length} modules
        </p>
        {course.modules.length === 0 && (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
            No modules published yet. Check back soon.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {course.modules.map((mod: CourseModule, idx: number) => {
            const isComplete = completed.has(mod.id)
            const isActive = mod.id === activeModule
            return (
              <button key={mod.id} onClick={() => setActiveModule(isActive ? null : mod.id)}
                style={{
                  background: 'var(--white)',
                  boxShadow: isActive ? '0 0 0 1.5px var(--teal), 0 2px 8px rgba(26,137,102,.14)' : 'var(--shadow-soft)',
                  borderRadius: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isComplete ? 'var(--teal)' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isComplete ? 16 : 18, flexShrink: 0, color: isComplete ? '#fff' : 'var(--near-black)' }}>
                  {isComplete ? '✓' : MODULE_ICONS[mod.type]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: 'var(--near-black)' }}>{idx + 1}. {mod.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--mid-grey)', marginTop: 2, textTransform: 'capitalize' }}>{mod.type} · {mod.duration_minutes} min</div>
                </div>
                {isComplete ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', padding: '3px 9px', borderRadius: 20 }}>Done</span>
                ) : isActive && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Start</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
