'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { QuizQuestion, QuestionType } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'
import { incrementUsed } from '@/lib/subscription'
import CreationGate from '@/components/brand/CreationGate'

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'ICT', 'French', 'History', 'Geography', 'Religious Studies', 'Physical Education']
const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3']
const TIME_OPTIONS = [10, 20, 30, 60]
const ANSWER_COLORS: Record<string, string> = { A: '#2E2886', B: '#1A8966', C: '#C23B2A', D: '#D97010' }

const QUESTION_TYPES: { key: QuestionType; label: string; desc: string }[] = [
  { key: 'mcq', label: 'Multiple choice', desc: '4 options, one correct' },
  { key: 'true_false', label: 'True / False', desc: '2 options, one correct' },
  { key: 'multi_select', label: 'Multi-select', desc: 'Multiple correct answers' },
  { key: 'short_answer', label: 'Short answer', desc: 'Typed text response' },
  { key: 'poll', label: 'Poll', desc: 'No correct answer' },
]

function emptyQuestion(type: QuestionType = 'mcq'): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    type,
    text: '',
    options: optionsForType(type),
    correct: 'A',
    correct_multiple: [],
    correct_text: '',
    time_seconds: 20,
    points: 100,
  }
}

function optionsForType(type: QuestionType) {
  if (type === 'true_false') return [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }]
  if (type === 'short_answer' || type === 'poll') return [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]
  return [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]
}

function typeIcon(type: QuestionType) {
  if (type === 'true_false') return 'T/F'
  if (type === 'multi_select') return '✓+'
  if (type === 'short_answer') return 'Aa'
  if (type === 'poll') return '◎'
  return 'A–D'
}

function QuizBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion('mcq')])
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  useEffect(() => {
    if (!editId) return
    async function loadQuiz() {
      const { data } = await supabase.from('quizzes').select('*').eq('id', editId).single()
      if (data) {
        setTitle(data.title)
        setSubject(data.subject ?? '')
        setGradeLevel(data.grade_level ?? '')
        setQuestions(data.questions?.length ? data.questions : [emptyQuestion()])
      }
      setLoadingEdit(false)
    }
    loadQuiz()
  }, [editId])

  function updateQuestion(index: number, updates: Partial<QuizQuestion>) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...updates } : q))
  }

  function updateOption(qIndex: number, oIndex: number, text: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      return { ...q, options: q.options.map((o, oi) => oi === oIndex ? { ...o, text } : o) }
    }))
  }

  function changeType(type: QuestionType) {
    const base = questions[activeQuestion]
    setQuestions(prev => prev.map((q, i) => i !== activeQuestion ? q : {
      ...q,
      type,
      options: type === 'true_false'
        ? [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }]
        : type === 'short_answer'
        ? []
        : q.options.length === 2
        ? [...q.options, { label: 'C', text: '' }, { label: 'D', text: '' }]
        : q.options,
      correct: type === 'true_false' ? 'A' : base.correct,
      correct_multiple: [],
      correct_text: '',
    }))
    setShowTypeMenu(false)
  }

  function toggleMultiCorrect(label: string) {
    const q = questions[activeQuestion]
    const current = q.correct_multiple ?? []
    const next = current.includes(label) ? current.filter(l => l !== label) : [...current, label]
    updateQuestion(activeQuestion, { correct_multiple: next })
  }

  function addQuestion(type: QuestionType = 'mcq') {
    setQuestions(prev => [...prev, emptyQuestion(type)])
    setActiveQuestion(questions.length)
    setShowTypeMenu(false)
  }

  function removeQuestion(index: number) {
    if (questions.length === 1) return
    setQuestions(prev => prev.filter((_, i) => i !== index))
    setActiveQuestion(Math.max(0, index - 1))
  }

  async function save(publish: boolean, gateCheck?: () => Promise<boolean>) {
    if (!title.trim()) { alert('Give your quiz a title first.'); return }
    if (!editId && gateCheck) {
      const allowed = await gateCheck()
      if (!allowed) return
    }
    setSaving(true)
    const payload = {
      institution_id: getCurrentUser().institution_id,
      creator_id: getCurrentUser().id,
      title: title.trim(),
      subject: subject || null,
      grade_level: gradeLevel || null,
      questions,
      settings: {},
      is_published: publish,
      updated_at: new Date().toISOString(),
    }
    let error: unknown
    if (editId) {
      const res = await supabase.from('quizzes').update(payload).eq('id', editId).select('id').single()
      error = res.error
    } else {
      const res = await supabase.from('quizzes').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single()
      error = res.error
    }
    setSaving(false)
    if (error) {
      const msg = (error as { message?: string })?.message ?? JSON.stringify(error)
      alert(`Save failed: ${msg}`)
      return
    }
    if (!editId) await incrementUsed('engage')
    router.push('/engage')
  }

  const q = questions[activeQuestion]

  if (loadingEdit) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', color: 'var(--mid-grey)', fontSize: 14 }}>
      Opening your quiz...
    </div>
  )

  return (
    <CreationGate module="engage">
      {({ check }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="engage"
        title={editId ? 'Edit quiz' : 'New quiz'}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => save(false, check)} disabled={saving} style={{ background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--near-black)' }}>
              {saving ? 'Saving...' : 'Save draft'}
            </button>
            <button onClick={() => save(true, check)} disabled={saving} style={{ background: '#D97010', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              Publish quiz
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: 240, borderRight: '0.5px solid var(--border)', background: 'var(--white)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 12, overflowY: 'auto' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz title" style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontWeight: 600, color: 'var(--near-black)', width: '100%', boxSizing: 'border-box' }} />
          <select value={subject} onChange={e => setSubject(e.target.value)} style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: subject ? 'var(--near-black)' : 'var(--mid-grey)', width: '100%', boxSizing: 'border-box' }}>
            <option value="">Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: gradeLevel ? 'var(--near-black)' : 'var(--mid-grey)', width: '100%', boxSizing: 'border-box' }}>
            <option value="">Grade level</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)', marginBottom: 8 }}>Questions</p>
            {questions.map((q, i) => (
              <div key={q.id} onClick={() => setActiveQuestion(i)} style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: activeQuestion === i ? '#FEF0DC' : 'transparent', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 5, background: activeQuestion === i ? '#D97010' : 'var(--bg2)', color: activeQuestion === i ? '#fff' : 'var(--mid-grey)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: activeQuestion === i ? '#D97010' : 'var(--near-black)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.text || 'New question'}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: activeQuestion === i ? '#D97010' : 'var(--mid-grey)', flexShrink: 0 }}>{typeIcon(q.type ?? 'mcq')}</span>
              </div>
            ))}

            {/* Add question with type picker */}
            <div style={{ position: 'relative', marginTop: 4 }}>
              <button onClick={() => setShowTypeMenu(v => !v)} style={{ width: '100%', padding: '8px', background: 'transparent', border: '0.5px dashed var(--border)', borderRadius: 7, fontSize: 12, color: 'var(--mid-grey)', cursor: 'pointer', textAlign: 'center' }}>
                + Add question
              </button>
              {showTypeMenu && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--white)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 50, overflow: 'hidden', marginBottom: 4 }}>
                  {QUESTION_TYPES.map(t => (
                    <button key={t.key} onClick={() => addQuestion(t.key)} style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: question editor */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>
                Question {activeQuestion + 1} of {questions.length}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Type selector */}
                <select value={q.type ?? 'mcq'} onChange={e => changeType(e.target.value as QuestionType)} style={{ height: 32, padding: '0 10px', borderRadius: 7, boxShadow: 'var(--shadow-soft)', background: 'var(--white)', fontSize: 12, color: 'var(--near-black)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(activeQuestion)} style={{ background: 'transparent', border: 'none', color: '#C23B2A', fontSize: 12, cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Question text */}
            <textarea
              value={q.text}
              onChange={e => updateQuestion(activeQuestion, { text: e.target.value })}
              placeholder="What's the question?"
              rows={3}
              style={{ width: '100%', background: 'var(--white)', boxShadow: 'var(--shadow-soft)', borderRadius: 10, padding: '14px 16px', fontSize: 16, fontWeight: 500, color: 'var(--near-black)', resize: 'vertical', boxSizing: 'border-box', marginBottom: 20, fontFamily: 'inherit' }}
            />

            {/* MCQ / Poll options */}
            {(q.type === 'mcq' || q.type === 'poll' || !q.type) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {q.options.map((opt, oi) => {
                  const isCorrect = q.correct === opt.label
                  return (
                    <div key={opt.label} style={{ background: isCorrect && q.type !== 'poll' ? `${ANSWER_COLORS[opt.label]}15` : 'var(--white)', border: `0.5px solid ${isCorrect && q.type !== 'poll' ? ANSWER_COLORS[opt.label] : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: ANSWER_COLORS[opt.label], color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {opt.label}
                      </span>
                      <input value={opt.text} onChange={e => updateOption(activeQuestion, oi, e.target.value)} placeholder={`Option ${opt.label}`} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, color: 'var(--near-black)', outline: 'none', fontFamily: 'inherit' }} />
                      {q.type !== 'poll' && (
                        <button onClick={() => updateQuestion(activeQuestion, { correct: opt.label })} title="Mark as correct" style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isCorrect ? ANSWER_COLORS[opt.label] : 'var(--border)'}`, background: isCorrect ? ANSWER_COLORS[opt.label] : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* True / False */}
            {q.type === 'true_false' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                {[{ label: 'A', text: 'True', color: '#1A8966' }, { label: 'B', text: 'False', color: '#C23B2A' }].map(opt => {
                  const isCorrect = q.correct === opt.label
                  return (
                    <button key={opt.label} onClick={() => updateQuestion(activeQuestion, { correct: opt.label })} style={{ padding: '28px 20px', borderRadius: 12, border: `2px solid ${isCorrect ? opt.color : 'var(--border)'}`, background: isCorrect ? `${opt.color}18` : 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: isCorrect ? opt.color : 'var(--near-black)' }}>
                        {opt.text === 'True' ? '✓' : '✗'}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: isCorrect ? opt.color : 'var(--near-black)' }}>{opt.text}</span>
                      {isCorrect && <span style={{ fontSize: 11, fontWeight: 600, color: opt.color, background: `${opt.color}20`, padding: '2px 8px', borderRadius: 4 }}>Correct answer</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Multi-select */}
            {q.type === 'multi_select' && (
              <>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 10 }}>Select all correct answers. Students must choose all of them to score points.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  {q.options.map((opt, oi) => {
                    const isCorrect = (q.correct_multiple ?? []).includes(opt.label)
                    return (
                      <div key={opt.label} style={{ background: isCorrect ? `${ANSWER_COLORS[opt.label]}15` : 'var(--white)', border: `0.5px solid ${isCorrect ? ANSWER_COLORS[opt.label] : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 6, background: ANSWER_COLORS[opt.label], color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {opt.label}
                        </span>
                        <input value={opt.text} onChange={e => updateOption(activeQuestion, oi, e.target.value)} placeholder={`Option ${opt.label}`} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, color: 'var(--near-black)', outline: 'none', fontFamily: 'inherit' }} />
                        <button onClick={() => toggleMultiCorrect(opt.label)} title="Toggle correct" style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isCorrect ? ANSWER_COLORS[opt.label] : 'var(--border)'}`, background: isCorrect ? ANSWER_COLORS[opt.label] : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isCorrect && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Short answer */}
            {q.type === 'short_answer' && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--mid-grey)', marginBottom: 8 }}>Correct answer (exact text match, not case-sensitive)</p>
                <input
                  value={q.correct_text ?? ''}
                  onChange={e => updateQuestion(activeQuestion, { correct_text: e.target.value })}
                  placeholder="Type the correct answer here"
                  style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 10, border: '0.5px solid #1A8966', background: '#DDFAF015', fontSize: 15, color: 'var(--near-black)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 8 }}>Students type their answer. It is marked correct if it matches this text.</p>
              </div>
            )}

            {/* Time + Points */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>Time limit</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TIME_OPTIONS.map(t => (
                    <button key={t} onClick={() => updateQuestion(activeQuestion, { time_seconds: t })} style={{ padding: '6px 12px', borderRadius: 6, border: `0.5px solid ${q.time_seconds === t ? '#D97010' : 'var(--border)'}`, background: q.time_seconds === t ? '#FEF0DC' : 'var(--white)', color: q.time_seconds === t ? '#D97010' : 'var(--near-black)', fontSize: 13, fontWeight: q.time_seconds === t ? 600 : 400, cursor: 'pointer' }}>
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
              {q.type !== 'poll' && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>Points</p>
                  <input type="number" value={q.points} onChange={e => updateQuestion(activeQuestion, { points: Number(e.target.value) })} min={0} step={50} style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 14, fontWeight: 600, color: 'var(--near-black)', width: 80, fontFamily: 'inherit' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      )}
    </CreationGate>
  )
}

export default function QuizBuilder() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mid-grey)' }}>Loading quiz builder...</div>}>
      <QuizBuilderInner />
    </Suspense>
  )
}
