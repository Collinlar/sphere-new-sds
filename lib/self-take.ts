'use client'

import { supabase } from './supabase'
import { generateJoinCode } from './utils'
import { isAcquiredContent, type ContentTable } from './acquisition-access'
import type { ExamSession } from './types'

export type SelfTakeResult =
  | { ok: true }
  | { ok: false; error: string }

export async function assertCanTakeAcquired(
  table: ContentTable,
  contentId: string
): Promise<SelfTakeResult> {
  const allowed = await isAcquiredContent(table, contentId)
  if (!allowed) {
    return { ok: false, error: 'This resource is not in your library, or your plan cannot access it.' }
  }
  return { ok: true }
}

export async function ensureCourseEnrollment(
  courseId: string,
  userId: string
): Promise<{ ok: true; enrollmentId: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_id', userId)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, enrollmentId: existing.id as string }
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      course_id: courseId,
      student_id: userId,
      progress_percentage: 0,
      completed_modules: [],
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Could not start this course. Try again in a moment.' }
  }
  return { ok: true, enrollmentId: data.id as string }
}

export async function ensurePathEnrollment(
  pathId: string,
  userId: string
): Promise<{ ok: true; enrollmentId: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('path_enrollments')
    .select('id')
    .eq('path_id', pathId)
    .eq('employee_id', userId)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, enrollmentId: existing.id as string }
  }

  const { data, error } = await supabase
    .from('path_enrollments')
    .insert({
      path_id: pathId,
      employee_id: userId,
      progress_percentage: 0,
      completed_steps: [],
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Could not start this training. Try again in a moment.' }
  }
  return { ok: true, enrollmentId: data.id as string }
}

function isSelfServeSession(session: { settings?: Record<string, unknown> | null }): boolean {
  return Boolean(session.settings?.self_serve)
}

export async function getOrCreateSelfExamSession(
  examId: string,
  userId: string,
  userName: string
): Promise<
  | { ok: true; session: ExamSession; joinCode: string; resumeSubmissionId: string | null }
  | { ok: false; error: string }
> {
  const { data: sessions } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('exam_id', examId)
    .in('status', ['active', 'scheduled', 'grading', 'completed'])
    .order('created_at', { ascending: false })

  const selfSessions = (sessions ?? []).filter(
    (s) =>
      isSelfServeSession(s as { settings?: Record<string, unknown> }) &&
      (s as { settings?: { owner_id?: string } }).settings?.owner_id === userId
  )

  for (const session of selfSessions) {
    const { data: openSub } = await supabase
      .from('exam_submissions')
      .select('id')
      .eq('exam_session_id', session.id)
      .eq('student_id', userId)
      .is('submitted_at', null)
      .maybeSingle()

    if (openSub?.id && session.status === 'active') {
      return {
        ok: true,
        session: session as ExamSession,
        joinCode: (session.join_code as string) ?? '',
        resumeSubmissionId: openSub.id as string,
      }
    }
  }

  const now = new Date().toISOString()
  const joinCode = generateJoinCode(6)

  const { data: newSession, error } = await supabase
    .from('exam_sessions')
    .insert({
      exam_id: examId,
      class_name: 'Self-take',
      scheduled_at: now,
      status: 'active',
      join_code: joinCode,
      invigilator_id: userId,
      settings: { self_serve: true, owner_id: userId },
      created_at: now,
    })
    .select('*')
    .single()

  if (error || !newSession) {
    return { ok: false, error: 'Could not start this assessment. Try again in a moment.' }
  }

  return {
    ok: true,
    session: newSession as ExamSession,
    joinCode,
    resumeSubmissionId: null,
  }
}

export async function isSelfServeSubmissionForUser(
  submissionId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('exam_submissions')
    .select('student_id, exam_sessions(settings)')
    .eq('id', submissionId)
    .maybeSingle()

  if (!data || data.student_id !== userId) return false
  const session = data.exam_sessions as { settings?: Record<string, unknown> } | null
  return isSelfServeSession(session ?? {})
}
