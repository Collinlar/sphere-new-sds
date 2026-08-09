import type { SupabaseClient } from '@supabase/supabase-js'

// AI credits. Server-side logic runs with the service-role client so it
// works regardless of RLS; read helpers for the browser are at the bottom.
//
// Allowance credits refresh monthly and do not roll over. Purchased credits
// never expire. Spending draws the allowance down first, so the credits a
// creator paid for are the last thing they lose.

export type CreditOwnerType = 'user' | 'institution'

export interface CreditOwner {
  ownerType: CreditOwnerType
  ownerId: string
}

export interface CreditAccount {
  ownerType: CreditOwnerType
  ownerId: string
  allowanceBalance: number
  purchasedBalance: number
  total: number
  lifetimePurchased: number
  lifetimeUsed: number
}

export const SIGNUP_GRANT_KEY = 'ai_credit_signup_grant'
export const COST_PER_ITEM_KEY = 'ai_credit_cost_per_item'
export const DEFAULT_SIGNUP_GRANT = 30
export const DEFAULT_COST_PER_ITEM = 1

/** Monthly included allowance per plan. Keys live in platform_settings. */
export const PLAN_ALLOWANCE_KEYS: Record<string, string> = {
  membership: 'ai_credits_membership',
  creator_quarterly: 'ai_credits_creator_quarterly',
  creator_marketplace: 'ai_credits_creator_marketplace',
  institution: 'ai_credits_institution',
}

export const DEFAULT_PLAN_ALLOWANCE: Record<string, number> = {
  membership: 0,
  creator_quarterly: 100,
  creator_marketplace: 100,
  institution: 500,
}

/** Top-up packs. Priced in MoMo-friendly round amounts. */
export interface CreditPack {
  id: string
  label: string
  credits: number
  priceGhs: number
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'try', label: 'Try it', credits: 30, priceGhs: 20 },
  { id: 'term', label: 'Term pack', credits: 100, priceGhs: 50 },
  { id: 'department', label: 'Department', credits: 400, priceGhs: 150 },
  { id: 'institution', label: 'Institution', credits: 1500, priceGhs: 500 },
]

export function findCreditPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find(p => p.id === id) ?? null
}

async function settingNumber(
  db: SupabaseClient,
  key: string,
  fallback: number
): Promise<number> {
  try {
    const { data } = await db.from('platform_settings').select('value').eq('key', key).maybeSingle()
    const parsed = Number(data?.value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  } catch {
    return fallback
  }
}

export async function creditCostForItems(db: SupabaseClient, items: number): Promise<number> {
  const perItem = await settingNumber(db, COST_PER_ITEM_KEY, DEFAULT_COST_PER_ITEM)
  return Math.max(0, Math.ceil(items * perItem))
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

/**
 * Load the credit account, applying the monthly allowance refresh lazily on
 * read so no scheduled job is needed. Creates the row on first touch.
 */
export async function loadCreditAccount(
  db: SupabaseClient,
  owner: CreditOwner,
  planId: string
): Promise<CreditAccount | null> {
  const now = new Date()

  let row: {
    allowance_balance?: number
    allowance_period_start?: string
    purchased_balance?: number
    lifetime_purchased?: number
    lifetime_granted?: number
    lifetime_used?: number
  } | null = null

  try {
    const { data, error } = await db
      .from('ai_credit_accounts')
      .select('allowance_balance, allowance_period_start, purchased_balance, lifetime_purchased, lifetime_granted, lifetime_used')
      .eq('owner_type', owner.ownerType)
      .eq('owner_id', owner.ownerId)
      .maybeSingle()
    if (error) throw error
    row = data
  } catch {
    return null // Credits not provisioned yet (migration pending).
  }

  const allowanceKey = PLAN_ALLOWANCE_KEYS[planId] ?? PLAN_ALLOWANCE_KEYS.membership
  const monthlyAllowance = await settingNumber(
    db,
    allowanceKey,
    DEFAULT_PLAN_ALLOWANCE[planId] ?? 0
  )

  // First touch: open the account with a signup grant plus this month's allowance.
  if (!row) {
    const grant = owner.ownerType === 'user'
      ? await settingNumber(db, SIGNUP_GRANT_KEY, DEFAULT_SIGNUP_GRANT)
      : 0

    await db.from('ai_credit_accounts').upsert(
      {
        owner_type: owner.ownerType,
        owner_id: owner.ownerId,
        allowance_balance: monthlyAllowance,
        allowance_period_start: now.toISOString(),
        purchased_balance: grant,
        lifetime_granted: grant,
        updated_at: now.toISOString(),
      },
      { onConflict: 'owner_type,owner_id' }
    )

    if (grant > 0) {
      await recordTransaction(db, owner, grant, 'signup_grant', 'Welcome credits', grant)
    }

    return {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      allowanceBalance: monthlyAllowance,
      purchasedBalance: grant,
      total: monthlyAllowance + grant,
      lifetimePurchased: 0,
      lifetimeUsed: 0,
    }
  }

  // Refresh the allowance if the month rolled over. Deliberately does not
  // accumulate: included credits are use-it-or-lose-it, bought ones are not.
  let allowanceBalance = Number(row.allowance_balance ?? 0)
  const periodStart = row.allowance_period_start ? new Date(row.allowance_period_start) : now

  if (monthsBetween(periodStart, now) >= 1) {
    const fresh = new Date(periodStart)
    fresh.setMonth(fresh.getMonth() + monthsBetween(periodStart, now))
    allowanceBalance = monthlyAllowance
    await db
      .from('ai_credit_accounts')
      .update({
        allowance_balance: monthlyAllowance,
        allowance_period_start: fresh.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('owner_type', owner.ownerType)
      .eq('owner_id', owner.ownerId)

    if (monthlyAllowance > 0) {
      await recordTransaction(
        db,
        owner,
        monthlyAllowance,
        'allowance',
        'Monthly plan credits',
        monthlyAllowance + Number(row.purchased_balance ?? 0)
      )
    }
  }

  const purchasedBalance = Number(row.purchased_balance ?? 0)
  return {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    allowanceBalance,
    purchasedBalance,
    total: allowanceBalance + purchasedBalance,
    lifetimePurchased: Number(row.lifetime_purchased ?? 0),
    lifetimeUsed: Number(row.lifetime_used ?? 0),
  }
}

async function recordTransaction(
  db: SupabaseClient,
  owner: CreditOwner,
  delta: number,
  kind: string,
  reason: string,
  balanceAfter: number,
  extra?: { task?: string; actorUserId?: string }
) {
  try {
    await db.from('ai_credit_transactions').insert({
      owner_type: owner.ownerType,
      owner_id: owner.ownerId,
      delta,
      kind,
      reason,
      task: extra?.task ?? null,
      actor_user_id: extra?.actorUserId ?? null,
      balance_after: balanceAfter,
    })
  } catch {
    // The ledger is for audit. Never fail a generation because it did not write.
  }
}

/**
 * Spend credits for work already delivered. Draws the allowance down first.
 * Called AFTER generation with the delivered item count, never the requested
 * count, so a short or failed draft is not charged for.
 */
export async function spendCredits(
  db: SupabaseClient,
  owner: CreditOwner,
  amount: number,
  meta: { task: string; actorUserId: string }
): Promise<{ ok: boolean; remaining: number }> {
  if (amount <= 0) return { ok: true, remaining: 0 }

  const { data } = await db
    .from('ai_credit_accounts')
    .select('allowance_balance, purchased_balance, lifetime_used')
    .eq('owner_type', owner.ownerType)
    .eq('owner_id', owner.ownerId)
    .maybeSingle()

  if (!data) return { ok: false, remaining: 0 }

  const allowance = Number(data.allowance_balance ?? 0)
  const purchased = Number(data.purchased_balance ?? 0)

  const fromAllowance = Math.min(allowance, amount)
  const fromPurchased = Math.min(purchased, amount - fromAllowance)
  const spent = fromAllowance + fromPurchased
  const remaining = allowance - fromAllowance + (purchased - fromPurchased)

  await db
    .from('ai_credit_accounts')
    .update({
      allowance_balance: allowance - fromAllowance,
      purchased_balance: purchased - fromPurchased,
      lifetime_used: Number(data.lifetime_used ?? 0) + spent,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_type', owner.ownerType)
    .eq('owner_id', owner.ownerId)

  await recordTransaction(db, owner, -spent, 'spend', `Generated ${amount} item${amount === 1 ? '' : 's'}`, remaining, {
    task: meta.task,
    actorUserId: meta.actorUserId,
  })

  return { ok: true, remaining }
}

/** Add purchased, granted, or refunded credits. These never expire. */
export async function addCredits(
  db: SupabaseClient,
  owner: CreditOwner,
  amount: number,
  kind: 'purchase' | 'refund' | 'admin_grant',
  reason: string,
  actorUserId?: string
): Promise<{ ok: boolean; balance: number }> {
  if (amount <= 0) return { ok: false, balance: 0 }

  const { data } = await db
    .from('ai_credit_accounts')
    .select('allowance_balance, purchased_balance, lifetime_purchased, lifetime_granted')
    .eq('owner_type', owner.ownerType)
    .eq('owner_id', owner.ownerId)
    .maybeSingle()

  const allowance = Number(data?.allowance_balance ?? 0)
  const purchased = Number(data?.purchased_balance ?? 0) + amount
  const lifetimePurchased = Number(data?.lifetime_purchased ?? 0) + (kind === 'purchase' ? amount : 0)
  const lifetimeGranted = Number(data?.lifetime_granted ?? 0) + (kind === 'purchase' ? 0 : amount)

  const { error } = await db.from('ai_credit_accounts').upsert(
    {
      owner_type: owner.ownerType,
      owner_id: owner.ownerId,
      allowance_balance: allowance,
      purchased_balance: purchased,
      lifetime_purchased: lifetimePurchased,
      lifetime_granted: lifetimeGranted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_type,owner_id' }
  )

  if (error) return { ok: false, balance: allowance + purchased - amount }

  await recordTransaction(db, owner, amount, kind, reason, allowance + purchased, {
    actorUserId,
  })

  return { ok: true, balance: allowance + purchased }
}
