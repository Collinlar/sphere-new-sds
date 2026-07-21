import { supabase } from '@/lib/supabase'

export async function fetchCourseEnrollmentStats(courseIds: string[]): Promise<{
  totalEnrolled: number
  avgCompletion: number
  byCourse: Record<string, { enrolled: number; avgCompletion: number }>
}> {
  const empty = { totalEnrolled: 0, avgCompletion: 0, byCourse: {} as Record<string, { enrolled: number; avgCompletion: number }> }
  if (courseIds.length === 0) return empty

  const { data } = await supabase
    .from('enrollments')
    .select('course_id, progress_percentage')
    .in('course_id', courseIds)

  const rows = data ?? []
  if (rows.length === 0) return empty

  const byCourse: Record<string, { enrolled: number; sum: number }> = {}
  for (const row of rows) {
    const id = row.course_id as string
    if (!byCourse[id]) byCourse[id] = { enrolled: 0, sum: 0 }
    byCourse[id].enrolled += 1
    byCourse[id].sum += Number(row.progress_percentage ?? 0)
  }

  const mapped: Record<string, { enrolled: number; avgCompletion: number }> = {}
  for (const [id, v] of Object.entries(byCourse)) {
    mapped[id] = {
      enrolled: v.enrolled,
      avgCompletion: v.enrolled > 0 ? Math.round(v.sum / v.enrolled) : 0,
    }
  }

  const totalEnrolled = rows.length
  const avgCompletion = Math.round(
    rows.reduce((sum, r) => sum + Number(r.progress_percentage ?? 0), 0) / totalEnrolled,
  )

  return { totalEnrolled, avgCompletion, byCourse: mapped }
}
