import { supabase } from '@/lib/supabase'

export interface StudentBadge {
  key: string
  label: string
  description: string
  earned: boolean
  icon: string
  color: string
  bg: string
}

export async function fetchStudentBadges(studentId: string): Promise<StudentBadge[]> {
  const [submissionRes, enrollRes] = await Promise.all([
    supabase.from('exam_submissions').select('percentage, submitted_at').eq('student_id', studentId).not('percentage', 'is', null),
    supabase.from('enrollments').select('progress_percentage, enrolled_at').eq('student_id', studentId),
  ])

  const submissions = submissionRes.data ?? []
  const enrollments = enrollRes.data ?? []

  const activityDates = new Set<string>()
  submissions.forEach(s => { if (s.submitted_at) activityDates.add(new Date(s.submitted_at).toDateString()) })
  enrollments.forEach(e => { if (e.enrolled_at) activityDates.add(new Date(e.enrolled_at).toDateString()) })
  let streak = 0
  const cursor = new Date()
  while (activityDates.has(cursor.toDateString())) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const hasFirstExam = submissions.length >= 1
  const hasPerfectScore = submissions.some(s => (s.percentage ?? 0) >= 100)
  const hasFinishedCourse = enrollments.some(e => (e.progress_percentage ?? 0) >= 100)

  return [
    { key: 'top_scorer', label: 'Top scorer', description: '100% on an exam', earned: hasPerfectScore, icon: 'TS', color: '#1A8966', bg: '#DDFAF0' },
    { key: 'streak_7', label: '7-day streak', description: '7 days active', earned: streak >= 7, icon: '7D', color: '#D97010', bg: '#FEF0DC' },
    { key: 'bookworm', label: 'Bookworm', description: 'Finished a course', earned: hasFinishedCourse, icon: 'BW', color: '#1052A3', bg: '#E3EDFB' },
    { key: 'speed', label: 'Speed demon', description: 'First exam done', earned: hasFirstExam, icon: 'SD', color: '#2E2886', bg: '#EEEDF8' },
    { key: 'streak_30', label: '30-day streak', description: '30 days active', earned: streak >= 30, icon: '30', color: '#1052A3', bg: '#E3EDFB' },
  ]
}
