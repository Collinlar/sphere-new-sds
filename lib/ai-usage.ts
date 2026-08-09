import type { SupabaseClient } from '@supabase/supabase-js'

// AI generation metering. Server-side only: called with the service-role
// client from the generate route, so it works regardless of RLS.
//
// The cap exists to bound runaway usage, not to nickel-and-dime creators.
// The default is deliberately generous; a normal teacher building exams will
// never see it, while a stuck loop is stopped and made visible.

export const DEFAULT_MONTHLY_GENERATION_LIMIT = 300
export const AI_LIMIT_KEY = 'ai_monthly_generation_limit'

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

/** Advance whole months so a user away for a while lands in the current window. */
function currentPeriodStart(periodStart: Date, now: Date): Date {
  const elapsed = monthsBetween(periodStart, now)
  if (elapsed < 1) return periodStart
  const next = new Date(periodStart)
  next.setMonth(next.getMonth() + elapsed)
  return next
}

async function resolveLimit(admin: SupabaseClient, override: number | null): Promise<number> {
  if (override != null && override > 0) return override
  try {
    const { data } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', AI_LIMIT_KEY)
      .maybeSingle()
    const parsed = Number(data?.value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_GENERATION_LIMIT
  } catch {
    return DEFAULT_MONTHLY_GENERATION_LIMIT
  }
}

export interface UsageCheck {
  allowed: boolean
  used: number
  limit: number
  error?: string
}

/**
 * Check the monthly cap and record one generation. Called before generating.
 * Degrades open: if the table is missing (migration not yet run) or the read
 * fails, the generation proceeds rather than blocking a paying customer.
 */
export async function checkAndRecordGeneration(
  admin: SupabaseClient,
  userId: string
): Promise<UsageCheck> {
  const now = new Date()

  let row: {
    period_start?: string
    generations_used?: number
    generations_all_time?: number
    monthly_limit?: number | null
  } | null = null

  try {
    const { data, error } = await admin
      .from('ai_generation_usage')
      .select('period_start, generations_used, generations_all_time, monthly_limit')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    row = data
  } catch {
    // Metering unavailable. Never block generation on it.
    return { allowed: true, used: 0, limit: DEFAULT_MONTHLY_GENERATION_LIMIT }
  }

  const limit = await resolveLimit(admin, row?.monthly_limit ?? null)

  const storedStart = row?.period_start ? new Date(row.period_start) : now
  const periodStart = currentPeriodStart(storedStart, now)
  const rolledOver = periodStart.getTime() !== storedStart.getTime()
  const used = rolledOver ? 0 : Number(row?.generations_used ?? 0)

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      error: `You have used all ${limit} AI generations this month. They reset on ${new Date(
        periodStart.getFullYear(),
        periodStart.getMonth() + 1,
        periodStart.getDate()
      ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Contact Sphere if you need more.`,
    }
  }

  try {
    await admin.from('ai_generation_usage').upsert(
      {
        user_id: userId,
        period_start: periodStart.toISOString(),
        generations_used: used + 1,
        generations_all_time: Number(row?.generations_all_time ?? 0) + 1,
        last_generated_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' }
    )
  } catch {
    // Recording failed. The user already passed the cap check, so let it run.
  }

  return { allowed: true, used: used + 1, limit }
}
