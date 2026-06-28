'use client'

import { useState, KeyboardEvent } from 'react'
import { IconClose, IconMail } from '@/components/icons'

interface InviteUsersModalProps {
  open: boolean
  onClose: () => void
  onSent: () => void
  institutionId: string
  invitedBy: string
}

const ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'admin', label: 'Admin' },
]

const DEPARTMENTS = ['Sales', 'Operations', 'HR', 'Finance', 'Customer Support', 'General']

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function InviteUsersModal({ open, onClose, onSent, institutionId, invitedBy }: InviteUsersModalProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [role, setRole] = useState('teacher')
  const [department, setDepartment] = useState('')
  const [sendWelcome, setSendWelcome] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  function addEmail(raw: string) {
    const email = raw.trim().toLowerCase()
    if (!email || !isValidEmail(email)) return
    if (emails.includes(email)) return
    setEmails(prev => [...prev, email])
    setInputValue('')
    setError('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      setEmails(prev => prev.slice(0, -1))
    }
  }

  function removeEmail(email: string) {
    setEmails(prev => prev.filter(e => e !== email))
  }

  async function sendInvites() {
    const pending = inputValue.trim()
    const finalEmails = pending && isValidEmail(pending)
      ? [...emails, pending.toLowerCase()]
      : emails

    if (finalEmails.length === 0) {
      setError('Add at least one email address.')
      return
    }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institutionId,
          invited_by: invitedBy,
          send_welcome: sendWelcome,
          invites: finalEmails.map(email => ({
            email,
            role,
            department: department || undefined,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not send invites. Try again.')
        setSending(false)
        return
      }

      const failed = (data.results ?? []).filter((r: { status: string }) => r.status === 'failed')
      if (failed.length === finalEmails.length) {
        setError(failed[0]?.reason ?? 'All invites failed.')
        setSending(false)
        return
      }

      setEmails([])
      setInputValue('')
      setRole('teacher')
      setDepartment('')
      setSendWelcome(true)
      setSending(false)
      onSent()
      onClose()
    } catch {
      setError('Network error. Check your connection and try again.')
      setSending(false)
    }
  }

  const count = emails.length + (inputValue.trim() && isValidEmail(inputValue.trim()) ? 1 : 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 16, 33, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 8px 32px rgba(12, 16, 33, 0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 22px 16px', borderBottom: '0.5px solid var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>Invite users</p>
            <p style={{ fontSize: 13, color: 'var(--mid-grey)', lineHeight: 1.5 }}>Add emails, pick a role, and send invites to your institution.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'var(--bg2)', border: 'none', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--mid-grey)', flexShrink: 0 }}
          >
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <p style={{ fontSize: 13, color: 'var(--coral)', background: '#FDECEA', borderRadius: 8, padding: '10px 12px' }}>{error}</p>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', display: 'block', marginBottom: 8 }}>Email addresses</label>
            <div
              style={{
                minHeight: 44,
                background: 'var(--bg2)',
                borderRadius: 8,
                padding: '8px 10px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {emails.map(email => (
                <span
                  key={email}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--white)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 13,
                    color: 'var(--near-black)',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--mid-grey)', display: 'flex' }}
                    aria-label={`Remove ${email}`}
                  >
                    <IconClose size={12} />
                  </button>
                </span>
              ))}
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => inputValue.trim() && addEmail(inputValue)}
                placeholder={emails.length === 0 ? 'name@school.edu.gh' : 'Add another'}
                type="email"
                style={{
                  flex: 1,
                  minWidth: 140,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  padding: '4px 2px',
                  color: 'var(--near-black)',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>Press Enter or comma to add each address.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', display: 'block', marginBottom: 8 }}>Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--bg2)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--near-black)',
                  cursor: 'pointer',
                }}
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--near-black)', display: 'block', marginBottom: 8 }}>Department</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--bg2)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--near-black)',
                  cursor: 'pointer',
                }}
              >
                <option value="">None</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={e => setSendWelcome(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--blue)' }}
            />
            <span style={{ fontSize: 13, color: 'var(--near-black)' }}>Send welcome message with login details</span>
          </label>
        </div>

        <div style={{ padding: '14px 22px 20px', borderTop: '0.5px solid var(--bg2)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--mid-grey)', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 14px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={sendInvites}
            disabled={sending || count === 0}
            style={{
              background: count > 0 && !sending ? 'var(--near-black)' : 'var(--bg2)',
              color: count > 0 && !sending ? '#fff' : 'var(--mid-grey)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: count > 0 && !sending ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconMail size={14} />
            {sending ? 'Sending invites...' : `Send ${count || 0} invite${count === 1 ? '' : 's'} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
