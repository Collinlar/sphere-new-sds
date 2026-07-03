import { getSupabaseAdmin } from './supabase-admin'

export interface InstitutionInquiryInput {
  userId: string
  institutionId: string
  institutionName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  studentCount?: number
  message?: string
}

export async function submitInstitutionInquiry(
  input: InstitutionInquiryInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Inquiries are not configured on this server yet.' }

  const { data, error } = await admin
    .from('institution_plan_inquiries')
    .insert({
      user_id: input.userId,
      institution_id: input.institutionId,
      institution_name: input.institutionName.trim(),
      contact_name: input.contactName.trim(),
      contact_email: input.contactEmail.trim().toLowerCase(),
      contact_phone: input.contactPhone?.trim() ?? null,
      student_count: input.studentCount ?? null,
      message: input.message?.trim() ?? null,
      status: 'new',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Your enquiry did not go through. Try again in a moment.' }
  }

  return { ok: true, id: data.id as string }
}
