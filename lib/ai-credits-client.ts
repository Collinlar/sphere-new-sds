'use client'

import { supabase } from './supabase'
import { getActiveContext } from './context'
import { getCurrentUser } from './auth'

// Browser-side credit reads. Writes always happen server-side.

export interface CreditBalance {
  ownerType: 'user' | 'institution'
  allowance: number
  purchased: number
  total: number
  /** True when spending draws on a shared institution balance. */
  pooled: boolean
}

/**
 * The balance that applies right now. Institution context spends the pooled
 * institution balance; personal context spends the creator's own.
 * Returns null when credits are not provisioned yet, so callers can hide
 * credit UI rather than show zeros.
 */
export async function getCreditBalance(): Promise<CreditBalance | null> {
  const ctx = getActiveContext()
  const ownerType: 'user' | 'institution' = ctx.type === 'institution' ? 'institution' : 'user'
  const ownerId = ctx.type === 'institution' ? ctx.institutionId : getCurrentUser().id
  if (!ownerId) return null

  try {
    const { data, error } = await supabase
      .from('ai_credit_accounts')
      .select('allowance_balance, purchased_balance')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .maybeSingle()

    if (error) return null

    const allowance = Number(data?.allowance_balance ?? 0)
    const purchased = Number(data?.purchased_balance ?? 0)
    return {
      ownerType,
      allowance,
      purchased,
      total: allowance + purchased,
      pooled: ownerType === 'institution',
    }
  } catch {
    return null
  }
}

/** The institution id to bill against, or undefined for personal work. */
export function creditContextInstitutionId(): string | undefined {
  const ctx = getActiveContext()
  return ctx.type === 'institution' ? ctx.institutionId : undefined
}
