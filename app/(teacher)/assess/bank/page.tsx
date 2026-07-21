'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import TopBar from '@/components/brand/TopBar'
import { getCurrentUser } from '@/lib/auth'
import { getContentInstitutionId } from '@/lib/context'
import {
  deleteBankQuestion,
  listBankQuestions,
  saveToQuestionBank,
  type BankQuestionRow,
} from '@/lib/question-bank'
import type { ExamQuestion } from '@/lib/types'

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'ICT', 'French', 'History', 'Geography']

export default function QuestionBankPage() {
  const user = getCurrentUser()
  const [rows, setRows] = useState<BankQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [message, setMessage] = useState('')

  async function reload() {
    setLoading(true)
    const data = await listBankQuestions({
      institutionId: getContentInstitutionId(),
      creatorId: user.id,
      subject: subject || undefined,
      topic: topic || undefined,
      difficulty: difficulty || undefined,
    })
    setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete(id: string) {
    const ok = await deleteBankQuestion(id)
    if (!ok) {
      setMessage('Could not remove that question. Try again.')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  async function quickAddSample() {
    const sample: ExamQuestion = {
      id: crypto.randomUUID(),
      type: 'mcq',
      text: 'What is the capital of Ghana?',
      options: [
        { label: 'A', text: 'Kumasi' },
        { label: 'B', text: 'Accra' },
        { label: 'C', text: 'Tamale' },
        { label: 'D', text: 'Cape Coast' },
      ],
      correct: 'B',
      marks: 1,
    }
    const result = await saveToQuestionBank({
      institutionId: getContentInstitutionId(),
      creatorId: user.id,
      subject: 'Social Studies',
      topic: 'Geography',
      difficulty: 'foundation',
      question: sample,
    })
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage('Sample question saved to your bank.')
    await reload()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="assess"
        title="Question bank"
        right={
          <Link href="/assess/create" style={{ fontSize: 13, fontWeight: 600, color: '#C23B2A', textDecoration: 'none' }}>
            New exam →
          </Link>
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: 960 }}>
        <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 18, lineHeight: 1.55, maxWidth: 560 }}>
          Save reusable questions by subject, topic, and difficulty. Pull them into any exam from the builder.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={filterStyle}>
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" style={{ ...filterStyle, minWidth: 140 }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={filterStyle}>
            <option value="">All levels</option>
            <option value="foundation">Foundation</option>
            <option value="standard">Standard</option>
            <option value="challenge">Challenge</option>
          </select>
          <button type="button" onClick={() => void reload()} style={btnStyle('#C23B2A')}>Apply filters</button>
          <button type="button" onClick={() => void quickAddSample()} style={btnStyle('#18171A')}>Add sample question</button>
        </div>

        {message && (
          <p style={{ fontSize: 13, color: '#1A8966', marginBottom: 12 }}>{message}</p>
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--mid-grey)' }}>Loading your question bank...</p>
        ) : rows.length === 0 ? (
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No questions in the bank yet</p>
            <p style={{ fontSize: 14, color: 'var(--mid-grey)', marginBottom: 16 }}>Save questions from an exam builder, or add a sample to get started.</p>
            <button type="button" onClick={() => void quickAddSample()} style={btnStyle('#C23B2A')}>Add sample question</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.4, marginBottom: 6 }}>
                      {row.question.text || 'Untitled question'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                      {[row.subject, row.topic, row.difficulty, row.question.type, `${row.question.marks} marks`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => void handleDelete(row.id)} style={{ ...btnStyle('transparent'), color: '#C23B2A', border: '0.5px solid #F5C6C0' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const filterStyle: CSSProperties = {
  height: 40, borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--white)',
  padding: '0 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--near-black)',
}

function btnStyle(bg: string): CSSProperties {
  return {
    height: 40, padding: '0 14px', borderRadius: 8, border: 'none', background: bg,
    color: bg === 'transparent' ? '#C23B2A' : '#fff', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  }
}
