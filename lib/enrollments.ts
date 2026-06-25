import { supabase } from '@/lib/supabase'
import type { Course } from '@/lib/types'

export interface EnrollResult {
  added: number
  alreadyEnrolled: number
  total: number
}

export async function enrollRosterInCourse(course: Course): Promise<EnrollResult> {
  if (!course.roster_id) return { added: 0, alreadyEnrolled: 0, total: 0 }

  const { data: members } = await supabase
    .from('roster_members')
    .select('user_id, groups')
    .eq('roster_id', course.roster_id)
    .eq('status', 'active')

  if (!members || members.length === 0) return { added: 0, alreadyEnrolled: 0, total: 0 }

  const filtered = (course.audience_groups && course.audience_groups.length > 0)
    ? members.filter(m => (m.groups ?? []).some((g: string) => course.audience_groups!.includes(g)))
    : members

  const { data: existing } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('course_id', course.id)

  const existingIds = new Set((existing ?? []).map(e => e.student_id))
  const toEnroll = filtered.filter(m => !existingIds.has(m.user_id))

  if (toEnroll.length === 0) {
    return { added: 0, alreadyEnrolled: filtered.length, total: filtered.length }
  }

  const { error } = await supabase.from('enrollments').insert(
    toEnroll.map(m => ({
      course_id: course.id,
      student_id: m.user_id,
      progress_percentage: 0,
      completed_modules: [],
      enrolled_at: new Date().toISOString(),
    }))
  )

  if (error) throw error

  return { added: toEnroll.length, alreadyEnrolled: filtered.length - toEnroll.length, total: filtered.length }
}
