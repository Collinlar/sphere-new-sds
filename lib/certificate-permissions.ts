import { supabase } from './supabase'

export async function isCertificateIssuingEnabled(ownerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('certificate_permissions')
    .select('is_enabled')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!data) return true
  return data.is_enabled !== false
}

export async function setCertificatePermission(
  ownerId: string,
  ownerType: 'creator' | 'institution',
  isEnabled: boolean,
  updatedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('certificate_permissions').upsert(
    {
      owner_id: ownerId,
      owner_type: ownerType,
      is_enabled: isEnabled,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' }
  )

  if (error) return { ok: false, error: 'Could not update certificate permission.' }
  return { ok: true }
}
