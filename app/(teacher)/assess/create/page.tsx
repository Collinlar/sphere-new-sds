'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/brand/TopBar'
import { supabase } from '@/lib/supabase'
import type { ExamQuestion, ExamAudience, Roster } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'ICT', 'French', 'History', 'Geography', 'Religious Studies', 'Physical Education']
const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3']
const QUESTION_TYPES: { value: ExamQuestion['type']; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short', label: 'Short answer' },
  { value: 'essay', label: 'Essay' },
]

function emptyQuestion(): ExamQuestion {
  return {
    id: crypto.randomUUID(),
    type: 'mcq',
    text: '',
    options: [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
    correct: 'A',
    marks: 2,
  }
}

export default function ExamCreate() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [duration, setDuration] = useState(60)
  const [instructions, setInstructions] = useState('')
  const [questions, setQuestions] = useState<ExamQuestion[]>([emptyQuestion()])
  const [activeQ, setActiveQ] = useState(0)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [integrityAction, setIntegrityAction] = useState<'record' | 'warn' | 'auto_disqualify'>('warn')
  const [integrityThreshold, setIntegrityThreshold] = useState(3)
  const [mobileTab, setMobileTab] = useState<'details' | 'questions'>('details')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [audience, setAudience] = useState<ExamAudience>('open')
  const [rosterId, setRosterId] = useState<string>('')
  const [audienceGroups, setAudienceGroups] = useState<string[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [rosterGroups, setRosterGroups] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('rosters')
      .select('*')
      .eq('institution_id', getCurrentUser().institution_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRosters(data ?? []))
  }, [])

  useEffect(() => {
    if (!rosterId) { setRosterGroups([]); return }
    supabase
      .from('roster_members')
      .select('groups')
      .eq('roster_id', rosterId)
      .then(({ data }) => {
        const groups = Array.from(new Set((data ?? []).flatMap(m => m.groups ?? [])))
        setRosterGroups(groups)
      })
  }, [rosterId])

  const q = questions[activeQ]
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)

  function updateQ(updates: Partial<ExamQuestion>) {
    setQuestions((prev) => prev.map((item, i) => (i === activeQ ? { ...item, ...updates } : item)))
  }

  function updateOption(oi: number, text: string) {
    setQuestions((prev) => prev.map((item, i) => {
      if (i !== activeQ) return item
      return { ...item, options: item.options!.map((o, idx) => idx === oi ? { ...o, text } : o) }
    }))
  }

  function addQuestion(type: ExamQuestion['type'] = 'mcq') {
    const newQ: ExamQuestion = {
      ...emptyQuestion(),
      type,
      options: (type === 'mcq') ? emptyQuestion().options : (type === 'true_false') ? [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }] : undefined,
      correct: (type === 'true_false') ? 'A' : (type === 'mcq') ? 'A' : undefined,
    }
    setQuestions((prev) => [...prev, newQ])
    setActiveQ(questions.length)
    setDrawerOpen(false)
  }

  async function handleSave() {
    if (!title.trim()) { alert('Add a title for your exam.'); return }
    setSaving(true)

    const { error } = await supabase.from('exams').insert({
      institution_id: getCurrentUser().institution_id,
      creator_id: getCurrentUser().id,
      title: title.trim(),
      subject: subject || null,
      grade_level: gradeLevel || null,
      duration_minutes: duration,
      instructions: instructions || null,
      questions,
      settings: {
        integrity_action: integrityAction,
        integrity_threshold: integrityThreshold,
      },
      audience,
      roster_id: audience === 'open' ? null : (rosterId || null),
      audience_groups: audience === 'open' ? null : audienceGroups,
      is_published: true,
      created_at: new Date().toISOString(),
    })

    setSaving(false)

    if (error) {
      alert('Could not save your exam. Check your connection and try again.')
      return
    }

    router.push('/assess')
  }

  const inputStyle = {
    background: 'var(--bg2)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--near-black)',
    width: '100%',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--page-bg)' }}>
      <style>{`
        /* Desktop: both panels always visible, tabs hidden */
        .mobile-tabs { display: none; }
        .exam-sidebar { display: flex; }
        .exam-editor { display: block; flex: 1; overflow-y: auto; padding: 28px 32px; }

        /* Mobile: tab-driven visibility */
        @media (max-width: 768px) {
          .mobile-tabs { display: flex; height: 44px; background: var(--white); border-bottom: 0.5px solid var(--border); }
          .mobile-tab-btn { flex: 1; border: none; background: transparent; color: var(--mid-grey); font-size: 13px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
          .mobile-tab-btn.active { color: #C23B2A; border-bottom: 2px solid #C23B2A; }
          .exam-layout { flex-direction: column; }
          .exam-sidebar { width: 100% !important; border-right: none !important; border-bottom: 0.5px solid var(--border); overflow: visible; }
          .exam-sidebar.tab-hidden { display: none !important; }
          .exam-editor { padding: 16px !important; }
          .exam-editor.tab-hidden { display: none !important; }
        }
      `}</style>
      <TopBar
        mode="assess"
        title="New exam"
        right={
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#C23B2A',
              border: 'none',
              borderRadius: 8,
              padding: '7px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save exam'}
          </button>
        }
      />

      {/* Mobile tabs */}
      <div className="mobile-tabs" style={{ display: 'none' }}>
        <button className={`mobile-tab-btn ${mobileTab === 'details' ? 'active' : ''}`} onClick={() => setMobileTab('details')} style={{ borderBottom: mobileTab === 'details' ? '2px solid #C23B2A' : '2px solid transparent', color: mobileTab === 'details' ? '#C23B2A' : 'var(--mid-grey)' }}>
          Details
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'questions' ? 'active' : ''}`} onClick={() => setMobileTab('questions')} style={{ borderBottom: mobileTab === 'questions' ? '2px solid #C23B2A' : '2px solid transparent', color: mobileTab === 'questions' ? '#C23B2A' : 'var(--mid-grey)' }}>
          Questions
        </button>
      </div>

      <div className="exam-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar — fixed metadata top, scrollable questions bottom */}
        <div className={`exam-sidebar ${mobileTab === 'details' ? 'mobile-show' : ''}`} style={{
          width: 260,
          borderRight: '0.5px solid var(--border)',
          background: 'var(--white)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Metadata zone — title always visible, rest collapsible so Questions gets the room */}
          <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title" style={{ ...inputStyle, fontWeight: 600, fontSize: 15 }} />

            <button
              onClick={() => setSettingsOpen(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'var(--bg2)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>
                Exam settings
              </span>
              <span style={{ fontSize: 11, color: 'var(--mid-grey)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {!settingsOpen && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {subject || 'No subject'} · {duration}m · {audience === 'open' ? 'Open' : audience === 'roster_login' ? 'Login' : 'Tickets'}
                  </span>
                )}
                <span>{settingsOpen ? '▴' : '▾'}</span>
              </span>
            </button>

            {settingsOpen && (
              <>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inputStyle, color: subject ? 'var(--near-black)' : 'var(--mid-grey)' }}>
              <option value="">Subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} style={{ ...inputStyle, color: gradeLevel ? 'var(--near-black)' : 'var(--mid-grey)' }}>
              <option value="">Grade level</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--mid-grey)', whiteSpace: 'nowrap' }}>Duration (min)</span>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} style={{ ...inputStyle, width: 72 }} />
            </div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Exam instructions (optional)" rows={2} style={{ ...inputStyle, resize: 'none' }} />

            {/* Integrity monitoring — compact pill row */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mid-grey)', marginBottom: 6 }}>Integrity</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { value: 'record',          label: 'Record' },
                  { value: 'warn',            label: 'Warn' },
                  { value: 'auto_disqualify', label: 'Auto-DQ' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setIntegrityAction(opt.value)}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: `0.5px solid ${integrityAction === opt.value ? '#1A8966' : 'var(--border)'}`,
                      background: integrityAction === opt.value ? '#DDFAF0' : 'var(--page-bg)',
                      color: integrityAction === opt.value ? '#1A8966' : 'var(--mid-grey)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Contextual desc + threshold */}
              <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 5, lineHeight: 1.4 }}>
                {integrityAction === 'record' && 'Events logged silently. Review during grading.'}
                {integrityAction === 'warn' && 'Student sees a warning on each detected violation.'}
                {integrityAction === 'auto_disqualify' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Disqualify after
                    <input
                      type="number" min={1} max={20} value={integrityThreshold}
                      onChange={(e) => setIntegrityThreshold(Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 36, padding: '2px 4px', fontSize: 11, boxShadow: 'var(--shadow-soft)', borderRadius: 4, textAlign: 'center', fontFamily: 'inherit', background: 'var(--white)' }}
                    />
                    violations.
                  </span>
                )}
              </p>
            </div>

            {/* Audience — who can take this exam, compact pill row matching Integrity above */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--mid-grey)', marginBottom: 6 }}>Who can take this</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { value: 'open', label: 'Open' },
                  { value: 'roster_login', label: 'Login' },
                  { value: 'roster_ticket', label: 'Tickets' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: `0.5px solid ${audience === opt.value ? '#2E2886' : 'var(--border)'}`,
                      background: audience === opt.value ? '#EEEDF8' : 'var(--page-bg)',
                      color: audience === opt.value ? '#2E2886' : 'var(--mid-grey)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 11, color: 'var(--mid-grey)', marginTop: 5, lineHeight: 1.4 }}>
                {audience === 'open' && 'Anyone with the join code can take this.'}
                {audience === 'roster_login' && 'Students sign in and must be on the roster to take it.'}
                {audience === 'roster_ticket' && 'Each roster student gets a personal code, no login needed.'}
              </p>

              {audience !== 'open' && (
                <div style={{ marginTop: 6 }}>
                  <select value={rosterId} onChange={(e) => { setRosterId(e.target.value); setAudienceGroups([]) }} style={{ ...inputStyle, width: '100%', marginBottom: 6 }}>
                    <option value="">Choose a roster</option>
                    {rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {rosters.length === 0 && (
                    <p style={{ fontSize: 11, color: 'var(--mid-grey)' }}>
                      You have no rosters yet. <a href="/students" style={{ color: '#2E2886' }}>Create one first.</a>
                    </p>
                  )}
                  {rosterGroups.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {rosterGroups.map(g => {
                        const active = audienceGroups.includes(g)
                        return (
                          <button
                            key={g}
                            onClick={() => setAudienceGroups(prev => active ? prev.filter(x => x !== g) : [...prev, g])}
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12, border: '0.5px solid #2E288640', background: active ? '#2E2886' : '#fff', color: active ? '#fff' : '#2E2886', cursor: 'pointer' }}
                          >
                            {g}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
              </>
            )}
          </div>

          {/* Questions zone — flex: 1, scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mid-grey)' }}>Questions</p>
              <span style={{ fontSize: 11, color: 'var(--mid-grey)' }}>{totalMarks} marks</span>
            </div>
            {questions.map((item, i) => (
              <div
                key={item.id}
                onClick={() => setActiveQ(i)}
                style={{
                  padding: '7px 8px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: activeQ === i ? '#FDECEA' : 'transparent',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: activeQ === i ? '#C23B2A' : 'var(--bg2)',
                  color: activeQ === i ? '#fff' : 'var(--mid-grey)',
                  fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: activeQ === i ? '#C23B2A' : 'var(--near-black)' }}>
                  {item.text || `${QUESTION_TYPES.find(t => t.value === item.type)?.label ?? 'Question'}`}
                </span>
                <span style={{ fontSize: 10, color: 'var(--mid-grey)', flexShrink: 0 }}>{item.marks}m</span>
              </div>
            ))}
          </div>

          {/* Add question footer — pinned outside overflow so dropdown is never clipped */}
          <div style={{ flexShrink: 0, padding: '8px 12px', borderTop: '0.5px solid var(--border)', position: 'relative' }}>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'transparent',
                border: '0.5px dashed var(--border)',
                borderRadius: 7,
                fontSize: 12,
                color: 'var(--mid-grey)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Add question
            </button>
            {drawerOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 12, right: 12,
                background: 'var(--white)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
                zIndex: 10,
              }}>
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => addQuestion(t.value)}
                    style={{
                      display: 'block', width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '0.5px solid var(--border)',
                      textAlign: 'left',
                      fontSize: 13,
                      color: 'var(--near-black)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: question editor — show only on desktop or when questions tab active on mobile */}
        <div className={`exam-editor ${mobileTab === 'questions' ? 'mobile-show' : ''}`} style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#C23B2A',
                background: '#FDECEA',
                padding: '3px 8px',
                borderRadius: 4,
              }}>
                {QUESTION_TYPES.find(t => t.value === q.type)?.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>Question {activeQ + 1}</span>
            </div>

            <textarea
              value={q.text}
              onChange={(e) => updateQ({ text: e.target.value })}
              placeholder="What's the question?"
              rows={3}
              style={{
                width: '100%',
                background: 'var(--white)',
                boxShadow: 'var(--shadow-soft)',
                borderRadius: 10,
                padding: '14px 16px',
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--near-black)',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: 20,
                fontFamily: 'inherit',
              }}
            />

            {/* MCQ options */}
            {(q.type === 'mcq' || q.type === 'true_false') && q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {q.options.map((opt, oi) => {
                  const isCorrect = q.correct === opt.label
                  return (
                    <div key={opt.label} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: 'var(--white)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      boxShadow: isCorrect ? '0 0 0 1.5px var(--teal), 0 2px 8px rgba(26,137,102,.1)' : 'var(--shadow-soft)',
                    }}>
                      <button
                        onClick={() => updateQ({ correct: opt.label })}
                        title="Mark correct"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: isCorrect ? 'none' : '1.5px solid var(--bg2)',
                          background: isCorrect ? 'var(--teal)' : 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isCorrect && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {q.type === 'true_false' ? (
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--near-black)' }}>{opt.label}. {opt.text}</span>
                      ) : (
                        <input
                          value={opt.text}
                          onChange={(e) => updateOption(oi, e.target.value)}
                          placeholder={`${opt.label}. Option ${opt.label}`}
                          style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--near-black)', outline: 'none', fontFamily: 'inherit' }}
                        />
                      )}
                      {isCorrect && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>Correct</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {(q.type === 'mcq' || q.type === 'true_false') && (
              <div style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-soft)', marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Explanation (shown after answer)
                </p>
                <textarea
                  value={q.explanation ?? ''}
                  onChange={(e) => updateQ({ explanation: e.target.value })}
                  placeholder="Explain why this is the correct answer..."
                  rows={2}
                  style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.55, fontFamily: 'inherit', background: 'transparent' }}
                />
              </div>
            )}

            {(q.type === 'short' || q.type === 'essay') && (
              <div style={{
                background: 'var(--bg2)',
                borderRadius: 10,
                padding: '14px 16px',
                color: 'var(--mid-grey)',
                fontSize: 14,
                marginBottom: 20,
              }}>
                Student writes {q.type === 'short' ? 'a short answer' : 'an essay response'} here
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--mid-grey)', marginBottom: 6 }}>Marks</p>
                <input
                  type="number"
                  value={q.marks}
                  onChange={(e) => updateQ({ marks: Number(e.target.value) })}
                  min={1}
                  style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 14, fontWeight: 600, color: 'var(--near-black)', width: 72, fontFamily: 'inherit' }}
                />
              </div>
              {questions.length > 1 && (
                <button
                  onClick={() => {
                    setQuestions((prev) => prev.filter((_, i) => i !== activeQ))
                    setActiveQ(Math.max(0, activeQ - 1))
                  }}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#C23B2A', fontSize: 12, cursor: 'pointer' }}
                >
                  Remove question
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
