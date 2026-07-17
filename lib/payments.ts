import { resolveInstitutionOnboardingDepositGhs } from './institution-deposit'
import { applyPlanUpgrade, upsertCreationUsageForPlan } from './plan-upgrade'
import { getSupabaseAdmin } from './supabase-admin'
import { importFromListing, type MarketplaceListingRow } from './marketplace-bridge'
import type { SubscriptionTier } from './types'

export type PaymentIntentType =
  | 'subscription'
  | 'addon'
  | 'marketplace'
  | 'plan_switch'
  | 'institution_deposit'

export interface PaymentPayload {
  planId?: string
  addOnId?: string
  listingId?: string
  institutionId?: string
  importDestinationKind?: 'personal' | 'institution'
  inquiryId?: string
}

export function institutionIdFromImportPayload(payload: PaymentPayload): string | null {
  if (payload.importDestinationKind === 'personal') return null
  return payload.institutionId ?? null
}

export async function assertInstitutionDepositCheckout(
  userId: string,
  payload: PaymentPayload
): Promise<{ ok: true; institutionId: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payments are not configured.' }

  if (!payload.institutionId) {
    return { ok: false, error: 'Missing institution for this deposit.' }
  }

  const { data: user } = await admin
    .from('users')
    .select('role, institution_id')
    .eq('id', userId)
    .maybeSingle()

  if (user?.role !== 'admin' || user.institution_id !== payload.institutionId) {
    return { ok: false, error: 'Only institution admins can pay the onboarding deposit.' }
  }

  const { data: institution } = await admin
    .from('institutions')
    .select('subscription_plan, onboarding_deposit_paid_at')
    .eq('id', payload.institutionId)
    .maybeSingle()

  if (!institution) {
    return { ok: false, error: 'That institution was not found.' }
  }

  if (institution.onboarding_deposit_paid_at) {
    return { ok: false, error: 'Your institution onboarding deposit is already paid.' }
  }

  if (institution.subscription_plan === 'institution') {
    return { ok: false, error: 'Your institution is already on the Institution plan.' }
  }

  if (payload.inquiryId) {
    const { data: inquiry } = await admin
      .from('institution_plan_inquiries')
      .select('id, institution_id, user_id')
      .eq('id', payload.inquiryId)
      .maybeSingle()

    if (!inquiry || inquiry.institution_id !== payload.institutionId || inquiry.user_id !== userId) {
      return { ok: false, error: 'That enquiry link is not valid for this checkout.' }
    }
  }

  return { ok: true, institutionId: payload.institutionId }
}

export async function createPaymentIntent(params: {
  userId: string
  reference: string
  intentType: PaymentIntentType
  payload: PaymentPayload
  amountPesewas: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payment storage is not configured.' }

  const { error } = await admin.from('payment_intents').insert({
    user_id: params.userId,
    reference: params.reference,
    intent_type: params.intentType,
    payload: params.payload,
    amount_pesewas: params.amountPesewas,
    status: 'pending',
  })

  if (error) return { ok: false, error: 'Could not record this checkout. Try again.' }
  return { ok: true }
}

// Billing period label, e.g. "2026-Q3", matching enrollment-billing.
function currentQuarterLabel(now = new Date()): string {
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
}

export async function fulfillPayment(reference: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payment fulfillment is not configured.' }

  const { data: intent } = await admin
    .from('payment_intents')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()

  if (!intent) return { ok: false, error: 'That payment reference was not found.' }
  if (intent.status === 'fulfilled') return { ok: true }

  const payload = intent.payload as PaymentPayload
  const now = new Date().toISOString()

  if (intent.intent_type === 'subscription' && payload.planId) {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 3)

    await admin.from('user_subscriptions').insert({
      user_id: intent.user_id,
      plan_id: payload.planId,
      status: 'active',
      started_at: now,
      expires_at: expiresAt.toISOString(),
      payment_reference: reference,
    })

    const upgraded = await applyPlanUpgrade(intent.user_id, payload.planId as SubscriptionTier, {
      resetUsed: true,
      client: admin,
    })
    if (!upgraded.ok) return upgraded
  }

  if (intent.intent_type === 'plan_switch' && payload.planId) {
    const switched = await applyPlanUpgrade(intent.user_id, payload.planId as SubscriptionTier, {
      resetUsed: true,
      client: admin,
    })
    if (!switched.ok) return switched
  }

  if (intent.intent_type === 'addon' && payload.addOnId) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await admin.from('user_add_ons').upsert(
      {
        user_id: intent.user_id,
        add_on_id: payload.addOnId,
        status: 'active',
        started_at: now,
        expires_at: expiresAt.toISOString(),
        payment_reference: reference,
      },
      { onConflict: 'user_id,add_on_id' }
    )
  }

  if (intent.intent_type === 'marketplace' && payload.listingId) {
    const institutionId = institutionIdFromImportPayload(payload)
    if (payload.importDestinationKind === 'institution' && !institutionId) {
      return { ok: false, error: 'Missing institution for this purchase.' }
    }
    const result = await fulfillMarketplacePurchase(
      intent.user_id,
      payload.listingId,
      institutionId,
      reference
    )
    if (!result.ok) return result
  }

  if (intent.intent_type === 'institution_deposit' && payload.institutionId) {
    await admin
      .from('institutions')
      .update({
        subscription_plan: 'institution',
        modules: ['engage', 'assess', 'learn', 'train'],
        onboarding_deposit_paid_at: now,
        onboarding_deposit_reference: reference,
      })
      .eq('id', payload.institutionId)

    // Lift free-tier admins to the institution tier, but never clobber a
    // paid personal plan: a Creator who also owns an institution keeps their
    // personal Creator subscription. Institution capabilities flow from the
    // institution's own plan via the active context, not the personal tier.
    await admin
      .from('users')
      .update({ subscription_tier: 'institution' })
      .eq('institution_id', payload.institutionId)
      .eq('role', 'admin')
      .eq('subscription_tier', 'membership')

    const { data: payerRow } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('id', intent.user_id)
      .maybeSingle()

    if (payerRow?.subscription_tier === 'institution') {
      const usageSeeded = await upsertCreationUsageForPlan(admin, intent.user_id, 'institution', {
        resetUsed: true,
      })
      if (!usageSeeded.ok) return usageSeeded
    }

    await admin.from('user_subscriptions').insert({
      user_id: intent.user_id,
      plan_id: 'institution',
      status: 'active',
      started_at: now,
      payment_reference: reference,
    })

    if (payload.inquiryId) {
      await admin
        .from('institution_plan_inquiries')
        .update({
          status: 'deposit_paid',
          deposit_reference: reference,
          deposit_paid_at: now,
        })
        .eq('id', payload.inquiryId)
    }

    // Auto-generate the receipt for this deposit so it appears on the
    // institution billing page and can be printed.
    const depositGhs = Number(intent.amount_pesewas ?? 0) / 100
    await admin.from('institution_invoices').insert({
      institution_id: payload.institutionId,
      invoice_type: 'deposit',
      description: 'Institution plan onboarding deposit',
      amount_ghs: depositGhs > 0 ? depositGhs : resolveInstitutionOnboardingDepositGhs(),
      period: currentQuarterLabel(),
      status: 'paid',
      reference,
      paid_at: now,
      issued_by: intent.user_id,
    })
  }

  await admin
    .from('payment_intents')
    .update({ status: 'fulfilled', fulfilled_at: now })
    .eq('reference', reference)

  return { ok: true }
}

async function fulfillMarketplacePurchase(
  buyerId: string,
  listingId: string,
  institutionId: string | null,
  paymentReference: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payment fulfillment is not configured.' }

  const { data: listing } = await admin
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!listing) return { ok: false, error: 'That listing is no longer available.' }

  const { data: creator } = await admin
    .from('users')
    .select('subscription_tier')
    .eq('id', listing.creator_id)
    .maybeSingle()

  const { data: creatorPlan } = await admin
    .from('subscription_plans')
    .select('marketplace_commission_rate')
    .eq('id', creator?.subscription_tier ?? 'membership')
    .maybeSingle()

  const commissionRate =
    (listing.commission_rate as number | null) ?? creatorPlan?.marketplace_commission_rate ?? 15
  const priceGhs = Number(listing.price_ghs ?? 0)
  const commissionGhs = Math.round(priceGhs * (commissionRate / 100) * 100) / 100
  const creatorEarnings = Math.round((priceGhs - commissionGhs) * 100) / 100

  const copied = await importFromListing(listing as MarketplaceListingRow, buyerId, institutionId)
  if (!copied.ok) return copied

  await admin.from('marketplace_purchases').insert({
    listing_id: listingId,
    buyer_id: buyerId,
    price_ghs: priceGhs,
    commission_rate: commissionRate,
    commission_ghs: commissionGhs,
    creator_earnings_ghs: creatorEarnings,
    payment_reference: paymentReference,
    payment_status: 'completed',
    purchased_at: new Date().toISOString(),
  })

  await admin.from('marketplace_imports').insert({
    listing_id: listingId,
    institution_id: institutionId,
    imported_by: buyerId,
  })

  await admin
    .from('marketplace_listings')
    .update({
      total_purchases: (listing.total_purchases ?? 0) + 1,
      total_revenue_ghs: Number(listing.total_revenue_ghs ?? 0) + priceGhs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (listing.creator_id) {
    const { data: profile } = await admin
      .from('creator_profiles')
      .select('total_sales, total_revenue_ghs')
      .eq('user_id', listing.creator_id)
      .maybeSingle()

    if (profile) {
      await admin
        .from('creator_profiles')
        .update({
          total_sales: (profile.total_sales ?? 0) + 1,
          total_revenue_ghs: Number(profile.total_revenue_ghs ?? 0) + creatorEarnings,
        })
        .eq('user_id', listing.creator_id)
    }
  }

  return { ok: true }
}

export async function resolvePaymentAmount(
  intentType: PaymentIntentType,
  payload: PaymentPayload
): Promise<{ ok: true; amountGhs: number; amountPesewas: number } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payments are not configured.' }

  if (intentType === 'plan_switch') {
    return { ok: true, amountGhs: 0, amountPesewas: 0 }
  }

  if (intentType === 'subscription' && payload.planId) {
    const { data: plan } = await admin
      .from('subscription_plans')
      .select('price_ghs')
      .eq('id', payload.planId)
      .single()

    const amountGhs = Number(plan?.price_ghs ?? 0)
    if (amountGhs <= 0) return { ok: false, error: 'That plan does not require payment.' }
    return { ok: true, amountGhs, amountPesewas: Math.round(amountGhs * 100) }
  }

  if (intentType === 'addon' && payload.addOnId) {
    const { data: addOn } = await admin
      .from('add_ons')
      .select('price_ghs, is_active')
      .eq('id', payload.addOnId)
      .single()

    if (!addOn?.is_active) return { ok: false, error: 'That add-on is not available.' }
    const amountGhs = Number(addOn.price_ghs ?? 0)
    if (amountGhs <= 0) return { ok: false, error: 'That add-on is not priced yet.' }
    return { ok: true, amountGhs, amountPesewas: Math.round(amountGhs * 100) }
  }

  if (intentType === 'marketplace' && payload.listingId) {
    const { data: listing } = await admin
      .from('marketplace_listings')
      .select('price_ghs, is_free, status')
      .eq('id', payload.listingId)
      .single()

    if (listing?.status !== 'approved') return { ok: false, error: 'That listing is not available for purchase.' }
    if (listing.is_free) return { ok: false, error: 'This resource is free. Import it instead.' }

    const amountGhs = Number(listing.price_ghs ?? 0)
    if (amountGhs <= 0) return { ok: false, error: 'That listing has no price set.' }
    return { ok: true, amountGhs, amountPesewas: Math.round(amountGhs * 100) }
  }

  if (intentType === 'institution_deposit') {
    const amountGhs = resolveInstitutionOnboardingDepositGhs()
    return { ok: true, amountGhs, amountPesewas: Math.round(amountGhs * 100) }
  }

  return { ok: false, error: 'Invalid checkout request.' }
}
