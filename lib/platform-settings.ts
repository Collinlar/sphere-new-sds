import { supabase } from './supabase'

// Small admin-tunable key/value store. Values are stored as text and parsed
// by the caller. Degrades gracefully to the provided fallback before the
// platform_settings migration runs.

export async function getPlatformSetting(key: string, fallback: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data?.value ?? fallback
  } catch {
    return fallback
  }
}

export async function getPlatformSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getPlatformSetting(key, String(fallback))
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function setPlatformSetting(key: string, value: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return { ok: !error }
}

export const GUEST_TTL_KEY = 'guest_session_ttl_days'
export const DEFAULT_GUEST_TTL_DAYS = 30
