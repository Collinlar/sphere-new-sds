import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  courseAchievementSummary,
  examAchievementSummary,
  trainingPathAchievementSummary,
  type CertResourceType,
} from '@/lib/certificates'

function typeLabel(resourceType: string): string {
  switch (resourceType) {
    case 'exam':
      return 'Assessment'
    case 'course':
      return 'Course'
    case 'training_path':
      return 'Training path'
    default:
      return resourceType.replace(/_/g, ' ')
  }
}

async function resolveIssuerName(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  opts: {
    issuerId: string | null
    resourceType: string
    resourceId: string
  }
): Promise<string | null> {
  const table =
    opts.resourceType === 'exam'
      ? 'exams'
      : opts.resourceType === 'course'
        ? 'courses'
        : opts.resourceType === 'training_path'
          ? 'learning_paths'
          : null

  if (table) {
    const { data: resource } = await admin
      .from(table)
      .select('institution_id, creator_id')
      .eq('id', opts.resourceId)
      .maybeSingle()

    if (resource?.institution_id) {
      const { data: inst } = await admin
        .from('institutions')
        .select('name')
        .eq('id', resource.institution_id)
        .maybeSingle()
      if (inst?.name) return inst.name as string
    }

    const creatorId = opts.issuerId ?? (resource?.creator_id as string | null) ?? null
    if (creatorId) {
      const { data: user } = await admin.from('users').select('name').eq('id', creatorId).maybeSingle()
      if (user?.name) return user.name as string
    }
  } else if (opts.issuerId) {
    const { data: user } = await admin.from('users').select('name').eq('id', opts.issuerId).maybeSingle()
    if (user?.name) return user.name as string
  }

  return null
}

async function resolveExamAchievement(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  opts: { resourceId: string; recipientId: string | null }
): Promise<{
  summary: string
  scorePercentage: number | null
  grade: string | null
  passMark: number | null
} | null> {
  const { data: exam } = await admin
    .from('exams')
    .select('certificate_pass_mark')
    .eq('id', opts.resourceId)
    .maybeSingle()

  const passMark = (exam?.certificate_pass_mark as number | null) ?? 50

  if (!opts.recipientId) {
    return {
      summary: `Passed the assessment (pass mark ${passMark}%)`,
      scorePercentage: null,
      grade: null,
      passMark,
    }
  }

  const { data: sessions } = await admin
    .from('exam_sessions')
    .select('id')
    .eq('exam_id', opts.resourceId)

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  if (sessionIds.length === 0) {
    return {
      summary: `Passed the assessment (pass mark ${passMark}%)`,
      scorePercentage: null,
      grade: null,
      passMark,
    }
  }

  const { data: submissions } = await admin
    .from('exam_submissions')
    .select('percentage, grade, submitted_at')
    .eq('student_id', opts.recipientId)
    .in('exam_session_id', sessionIds)
    .not('percentage', 'is', null)
    .order('percentage', { ascending: false })
    .limit(20)

  const qualifying = (submissions ?? []).find((s) => Number(s.percentage ?? 0) >= passMark)
  if (!qualifying) {
    return {
      summary: `Passed the assessment (pass mark ${passMark}%)`,
      scorePercentage: null,
      grade: null,
      passMark,
    }
  }

  const percentage = Number(qualifying.percentage)
  const grade = (qualifying.grade as string | null) ?? null
  return {
    summary: examAchievementSummary({ percentage, passMark, grade }),
    scorePercentage: percentage,
    grade,
    passMark,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const normalized = decodeURIComponent(code || '').trim().toUpperCase()
  if (!normalized) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Verification is not configured on this server yet.' },
      { status: 503 }
    )
  }

  // Avoid embedding users(name): issued_certificates has two FKs to users
  // (recipient_id and issuer_id), so an ambiguous PostgREST embed fails the
  // whole query and the public page incorrectly shows "Code not found".
  const { data: cert, error } = await admin
    .from('issued_certificates')
    .select(
      'verification_code, resource_type, resource_title, resource_id, issued_at, recipient_id, issuer_id, issuer_display_name, achievement_summary, score_percentage, grade, pass_mark'
    )
    .eq('verification_code', normalized)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!cert) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let recipientName = 'Verified recipient'
  if (cert.recipient_id) {
    const { data: user } = await admin
      .from('users')
      .select('name')
      .eq('id', cert.recipient_id)
      .maybeSingle()
    if (user?.name) recipientName = user.name as string
  }

  let issuerName = (cert.issuer_display_name as string | null) ?? null
  if (!issuerName) {
    issuerName = await resolveIssuerName(admin, {
      issuerId: (cert.issuer_id as string | null) ?? null,
      resourceType: cert.resource_type as string,
      resourceId: cert.resource_id as string,
    })
  }

  let achievementSummary = (cert.achievement_summary as string | null) ?? null
  let scorePercentage =
    cert.score_percentage != null ? Number(cert.score_percentage) : null
  let grade = (cert.grade as string | null) ?? null
  let passMark = cert.pass_mark != null ? Number(cert.pass_mark) : null

  if (!achievementSummary) {
    const resourceType = cert.resource_type as CertResourceType
    if (resourceType === 'exam') {
      const examAch = await resolveExamAchievement(admin, {
        resourceId: cert.resource_id as string,
        recipientId: (cert.recipient_id as string | null) ?? null,
      })
      if (examAch) {
        achievementSummary = examAch.summary
        scorePercentage = examAch.scorePercentage
        grade = examAch.grade
        passMark = examAch.passMark
      }
    } else if (resourceType === 'course') {
      achievementSummary = courseAchievementSummary()
    } else if (resourceType === 'training_path') {
      achievementSummary = trainingPathAchievementSummary()
    }
  }

  return NextResponse.json({
    verification_code: cert.verification_code,
    resource_type: cert.resource_type,
    resource_type_label: typeLabel(cert.resource_type as string),
    resource_title: cert.resource_title,
    issued_at: cert.issued_at,
    recipient_name: recipientName,
    issuer_name: issuerName || 'Sphere educator',
    achievement_summary: achievementSummary,
    score_percentage: scorePercentage,
    grade,
    pass_mark: passMark,
  })
}
