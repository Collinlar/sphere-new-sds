'use client'

import { useEffect, useState, useCallback, use, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { assertCanTakeAcquired, ensureCourseEnrollment } from '@/lib/self-take'
import { isAcquiredRow } from '@/lib/acquisition-access'
import { issueCertificate, getMyCertificate } from '@/lib/certificates'
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
    <div style={{ whiteSpace: 'pre-line' }}>
      {(content.body as string) || <span style={{ color: 'var(--mid-grey)' }}>No content yet.</span>}
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
  if (mod.type === 'reading' && !(mod.content?.body as string)?.trim()) {
    return <LessonMediaPlaceholder label="[ diagram or reading visual ]" />
  }
  return null
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

export default function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your course...</div>}>
      <StudentCoursePageInner params={params} />
    </Suspense>
  )
}

function StudentCoursePageInner({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const searchParams = useSearchParams()
  const fromLibrary = searchParams.get('from') === 'library'
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [isAcquired, setIsAcquired] = useState(false)
  const [certCode, setCertCode] = useState<string | null>(null)

  const userId = getCurrentUser()?.id

  useEffect(() => {
    async function load() {
      const [courseRes, enrollRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', params.id).single(),
        userId ? supabase.from('enrollments').select('id, completed_modules').eq('course_id', params.id).eq('student_id', userId).single() : Promise.resolve({ data: null, error: null }),
      ])
      if (courseRes.data) {
        setCourse(courseRes.data)
        setIsAcquired(isAcquiredRow(courseRes.data as Record<string, unknown>))
        // Surface an already-earned certificate on revisit.
        if (userId && (courseRes.data as Course).issues_certificate) {
          const existing = await getMyCertificate(userId, params.id)
          if (existing) setCertCode(existing.verificationCode)
        }
      }

      if (enrollRes.data) {
        setEnrollmentId(enrollRes.data.id)
        setCompleted(new Set(enrollRes.data.completed_modules ?? []))
      } else if (userId && courseRes.data) {
        const acquired = isAcquiredRow(courseRes.data as Record<string, unknown>)
        if (acquired) {
          const gate = await assertCanTakeAcquired('courses', params.id)
          if (gate.ok) {
            const enrolled = await ensureCourseEnrollment(params.id, userId)
            if (enrolled.ok) {
              setEnrollmentId(enrolled.enrollmentId)
            }
          }
        }
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

    // Course completion certificate: issued once when the course awards one.
    if (progress === 100 && course?.issues_certificate && userId) {
      const result = await issueCertificate({
        recipientId: userId,
        issuerId: course.creator_id ?? null,
        resourceType: 'course',
        resourceId: course.id,
        resourceTitle: course.title,
      })
      if (result.ok) setCertCode(result.verificationCode)
    }
  }, [enrollmentId, course, userId])

  function markComplete(id: string) {
    const next = new Set(Array.from(completed).concat(id))
    setCompleted(next)
    if (course) {
      persistProgress(next, course.modules)
      const idx = course.modules.findIndex((m) => m.id === id)
      const nextModule = idx >= 0 && idx < course.modules.length - 1 ? course.modules[idx + 1] : null
      setActiveModule(nextModule?.id ?? null)
    } else {
      setActiveModule(null)
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--mid-grey)', fontSize: 14 }}>Loading your course...</div>
  if (!course) return <div style={{ padding: 24, color: '#C23B2A', fontSize: 14 }}>Course not found.</div>

  const progress = course.modules.length > 0 ? Math.round((completed.size / course.modules.length) * 100) : 0
  const activeIdx = activeModule ? course.modules.findIndex((m) => m.id === activeModule) : -1
  const active = activeIdx >= 0 ? course.modules[activeIdx] : null
  const nextModule = activeIdx >= 0 && activeIdx < course.modules.length - 1 ? course.modules[activeIdx + 1] : null
  const prevModule = activeIdx > 0 ? course.modules[activeIdx - 1] : null
  const quizFollows = activeIdx >= 0 && course.modules[activeIdx + 1]?.type === 'quiz'
  const isActiveComplete = active ? completed.has(active.id) : false

  // Focused lesson view: matches the Study step card, with vertical CTAs (no Back/dots/Next slider).
  if (active) {
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
    }

    return (
      <div style={{ minHeight: '100vh', background: '#F7F4ED', width: '100%' }}>
        {(fromLibrary || isAcquired) && (
          <div style={{ padding: '12px 16px 0', maxWidth: 560, margin: '0 auto' }}>
            <Link
              href="/platform/library"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              Back to library
            </Link>
          </div>
        )}

        <LessonStepFrame
          subject={course.subject || 'Course'}
          stepIndex={activeIdx}
          stepCount={course.modules.length}
          title={active.title}
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
          {active.type === 'assignment' && enrollmentId && (
            <AssignmentModule content={active.content} moduleId={active.id} enrollmentId={enrollmentId} onSubmit={() => markComplete(active.id)} />
          )}
          {active.type === 'assignment' && !enrollmentId && (
            <p style={{ margin: 0, color: 'var(--mid-grey)' }}>Enrol to submit this assignment.</p>
          )}
        </LessonStepFrame>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', minHeight: '100vh', background: '#F7F4ED', width: '100%' }}>
      {(fromLibrary || isAcquired) && (
        <div style={{ padding: '12px 16px 0' }}>
          <Link
            href="/platform/library"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            Back to library
          </Link>
        </div>
      )}

      <div style={{ background: course.thumbnail_color, padding: '28px 20px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: '0.06em' }}>
          {[course.subject, course.grade_level].filter(Boolean).join(' · ')}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 16, lineHeight: 1.25 }}>{course.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 999 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 999, transition: 'width 0.25s ease' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{progress}%</span>
        </div>
      </div>

      {certCode && (
        <div style={{ margin: '12px 16px 0', background: '#1A8966', borderRadius: 12, padding: '14px 16px', color: '#fff' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            Certificate earned
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '3px 9px', borderRadius: 6, letterSpacing: '0.05em' }}>{certCode}</span>
            <a href={`/verify/${certCode}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'underline' }}>View and verify</a>
          </div>
        </div>
      )}

      <div style={{ padding: '16px 16px 40px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--mid-grey)', marginBottom: 12 }}>
          {course.modules.length} modules
        </p>

        {course.modules.length === 0 && (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
            No modules published yet. Check back soon.
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
                  width: '100%',
                  minHeight: 64,
                  padding: '14px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  boxShadow: '0 4px 16px rgba(17, 24, 39, 0.04)',
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
                    {idx + 1}. {mod.title}
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
  )
}
