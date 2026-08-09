import { resolveInstitutionOnboardingDepositGhs } from './institution-deposit'
import { applyPlanUpgrade, upsertCreationUsageForPlan } from './plan-upgrade'
import { addCredits, findCreditPack, type CreditOwner } from './ai-credits'
import { getSupabaseAdmin } from './supabase-admin'
import { importFromListing, type MarketplaceListingRow } from './marketplace-bridge'
import { usePathForImportedTarget, type MarketplacePurchaseReceipt } from './marketplace-receipt'
import type { SubscriptionTier } from './types'

export type PaymentIntentType =
  | 'subscription'
  | 'addon'
  | 'marketplace'
  | 'plan_switch'
  | 'institution_deposit'
  | 'credit_pack'

export interface PaymentPayload {
  planId?: string
  addOnId?: string
  listingId?: string
  institutionId?: string
  importDestinationKind?: 'personal' | 'institution'
  inquiryId?: string
  /** Credit top-up: which pack, and whether it lands in a pooled balance. */
  creditPackId?: string
  creditOwnerType?: 'user' | 'institution'
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

async function findBuyerCopyOfListing(
  listingId: string,
  buyerId: string,
  institutionId: string | null,
): Promise<{ targetType: string; targetId: string } | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const tables: { table: string; targetType: string }[] = [
    { table: 'quizzes', targetType: 'quiz' },
    { table: 'exams', targetType: 'exam' },
    { table: 'courses', targetType: 'course' },
    { table: 'learning_paths', targetType: 'training_path' },
  ]

  for (const { table, targetType } of tables) {
    let query = admin
      .from(table)
      .select('id')
      .eq('marketplace_listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)

    query = institutionId
      ? query.eq('institution_id', institutionId)
      : query.eq('creator_id', buyerId).is('institution_id', null)

    const { data } = await query.maybeSingle()
    if (data?.id) return { targetType, targetId: data.id as string }
  }

  return null
}

async function buildMarketplaceReceipt(params: {
  reference: string
  amountPesewas: number
  listingId: string
  buyerId: string
  institutionId: string | null
  targetType?: string | null
  targetId?: string | null
  listingTitle?: string | null
  purchasedAt?: string
}): Promise<MarketplacePurchaseReceipt> {
  const admin = getSupabaseAdmin()
  let listingTitle = params.listingTitle ?? 'Marketplace resource'
  if (admin && !params.listingTitle) {
    const { data: listing } = await admin
      .from('marketplace_listings')
      .select('title')
      .eq('id', params.listingId)
      .maybeSingle()
    if (listing?.title) listingTitle = listing.title as string
  }

  let targetType = params.targetType ?? null
  let targetId = params.targetId ?? null
  if ((!targetType || !targetId) && admin) {
    const copy = await findBuyerCopyOfListing(params.listingId, params.buyerId, params.institutionId)
    if (copy) {
      targetType = copy.targetType
      targetId = copy.targetId
    }
  }

  const use = usePathForImportedTarget(targetType, targetId)
  const amountGhs = Math.round((Number(params.amountPesewas ?? 0) / 100) * 100) / 100

  return {
    reference: params.reference,
    amountGhs,
    listingId: params.listingId,
    listingTitle,
    purchasedAt: params.purchasedAt ?? new Date().toISOString(),
    destinationLabel: params.institutionId ? 'Institution library' : 'My personal library',
    targetType,
    targetId,
    useHref: use?.href ?? '/platform/library',
    useLabel: use?.label ?? 'Open my library',
  }
}

export async function fulfillPayment(
  reference: string
): Promise<
  | { ok: true; receipt?: MarketplacePurchaseReceipt }
  | { ok: false; error: string }
> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payment fulfillment is not configured.' }

  const { data: intent } = await admin
    .from('payment_intents')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()

  if (!intent) return { ok: false, error: 'That payment reference was not found.' }

  const payload = intent.payload as PaymentPayload
  const now = new Date().toISOString()

  if (intent.status === 'fulfilled') {
    if (intent.intent_type === 'marketplace' && payload.listingId) {
      const institutionId = institutionIdFromImportPayload(payload)
      const receipt = await buildMarketplaceReceipt({
        reference,
        amountPesewas: Number(intent.amount_pesewas ?? 0),
        listingId: payload.listingId,
        buyerId: intent.user_id as string,
        institutionId,
        purchasedAt: (intent.fulfilled_at as string | null) ?? now,
      })
      return { ok: true, receipt }
    }
    return { ok: true }
  }

  let marketplaceReceipt: MarketplacePurchaseReceipt | undefined

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

  if (intent.intent_type === 'credit_pack' && payload.creditPackId) {
    const pack = findCreditPack(payload.creditPackId)
    if (!pack) return { ok: false, error: 'That credit pack is not available.' }

    // Pooled top-ups only count when the payer really belongs to the
    // institution, so a claimed institution id cannot redirect credits.
    let owner: CreditOwner = { ownerType: 'user', ownerId: intent.user_id }
    if (payload.creditOwnerType === 'institution' && payload.institutionId) {
      const { data: membership } = await admin
        .from('institution_members')
        .select('id')
        .eq('institution_id', payload.institutionId)
        .eq('user_id', intent.user_id)
        .eq('status', 'active')
        .maybeSingle()
      if (membership) {
        owner = { ownerType: 'institution', ownerId: payload.institutionId }
      }
    }

    const added = await addCredits(
      admin,
      owner,
      pack.credits,
      'purchase',
      `${pack.label}: ${pack.credits} credits for GHS ${pack.priceGhs}`,
      intent.user_id
    )
    if (!added.ok) {
      return { ok: false, error: 'Your credits did not land. Contact Sphere with your payment reference.' }
    }

    // Institution top-ups get a receipt alongside their other billing.
    if (owner.ownerType === 'institution') {
      await admin.from('institution_invoices').insert({
        institution_id: owner.ownerId,
        invoice_type: 'addon',
        description: `AI credits: ${pack.label} (${pack.credits} credits)`,
        amount_ghs: pack.priceGhs,
        period: currentQuarterLabel(),
        status: 'paid',
        reference,
        paid_at: now,
        issued_by: intent.user_id,
      })
    }
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

    marketplaceReceipt = await buildMarketplaceReceipt({
      reference,
      amountPesewas: Number(intent.amount_pesewas ?? 0),
      listingId: payload.listingId,
      buyerId: intent.user_id as string,
      institutionId,
      targetType: result.targetType,
      targetId: result.targetId,
      listingTitle: result.listingTitle,
      purchasedAt: now,
    })
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

  return { ok: true, receipt: marketplaceReceipt }
}

async function fulfillMarketplacePurchase(
  buyerId: string,
  listingId: string,
  institutionId: string | null,
  paymentReference: string
): Promise<
  | { ok: true; targetType: string; targetId: string; listingTitle: string; priceGhs: number }
  | { ok: false; error: string }
> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Payment fulfillment is not configured.' }

  const { data: listing } = await admin
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .eq('status', 'approved')
    .maybeSingle()

  let resolvedListing = listing
  if (!resolvedListing) {
    const mapped = await resolveMarketplaceListingForCheckout(listingId)
    if (mapped?.status === 'approved') {
      const { data: again } = await admin
        .from('marketplace_listings')
        .select('*')
        .eq('id', mapped.id)
        .eq('status', 'approved')
        .maybeSingle()
      resolvedListing = again
    }
  }

  if (!resolvedListing) return { ok: false, error: 'That listing is no longer available.' }

  const resolvedListingId = resolvedListing.id as string

  const { data: creator } = await admin
    .from('users')
    .select('subscription_tier')
    .eq('id', resolvedListing.creator_id)
    .maybeSingle()

  const { data: creatorPlan } = await admin
    .from('subscription_plans')
    .select('marketplace_commission_rate')
    .eq('id', creator?.subscription_tier ?? 'membership')
    .maybeSingle()

  const commissionRate =
    (resolvedListing.commission_rate as number | null) ?? creatorPlan?.marketplace_commission_rate ?? 15
  const priceGhs = Number(resolvedListing.price_ghs ?? 0)
  const commissionGhs = Math.round(priceGhs * (commissionRate / 100) * 100) / 100
  const creatorEarnings = Math.round((priceGhs - commissionGhs) * 100) / 100

  // Server fulfillment must use the admin client so RLS does not block the copy.
  const copied = await importFromListing(resolvedListing as MarketplaceListingRow, buyerId, institutionId, admin)
  if (!copied.ok) return copied

  await admin.from('marketplace_purchases').insert({
    listing_id: resolvedListingId,
    buyer_id: buyerId,
    price_ghs: priceGhs,
    commission_rate: commissionRate,
    commission_ghs: commissionGhs,
    creator_earnings_ghs: creatorEarnings,
    payment_reference: paymentReference,
    payment_status: 'completed',
    purchased_at: new Date().toISOString(),
  })

  // listing_id only — resource_id on marketplace_imports FKs marketplace_resources.
  await admin.from('marketplace_imports').insert({
    listing_id: resolvedListingId,
    institution_id: institutionId,
    imported_by: buyerId,
  })

  await admin
    .from('marketplace_listings')
    .update({
      total_purchases: (resolvedListing.total_purchases ?? 0) + 1,
      total_revenue_ghs: Number(resolvedListing.total_revenue_ghs ?? 0) + priceGhs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resolvedListingId)

  if (resolvedListing.creator_id) {
    const { data: profile } = await admin
      .from('creator_profiles')
      .select('total_sales, total_revenue_ghs')
      .eq('user_id', resolvedListing.creator_id)
      .maybeSingle()

    if (profile) {
      await admin
        .from('creator_profiles')
        .update({
          total_sales: (profile.total_sales ?? 0) + 1,
          total_revenue_ghs: Number(profile.total_revenue_ghs ?? 0) + creatorEarnings,
        })
        .eq('user_id', resolvedListing.creator_id)
    }
  }

  return {
    ok: true,
    targetType: copied.targetType,
    targetId: copied.targetId,
    listingTitle: resolvedListing.title as string,
    priceGhs,
  }
}


async function resolveMarketplaceListingForCheckout(listingOrResourceId: string): Promise<{
  id: string
  price_ghs: number | null
  is_free: boolean
  status: string
  title?: string
} | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data: listing } = await admin
    .from('marketplace_listings')
    .select('id, price_ghs, is_free, status, title')
    .eq('id', listingOrResourceId)
    .maybeSingle()

  if (listing) return listing

  // Catalog / legacy marketplace_resources may be opened in the UI; map to the linked listing.
  const { data: resource } = await admin
    .from('marketplace_resources')
    .select('id, title, listing_id, price_ghs, status')
    .eq('id', listingOrResourceId)
    .maybeSingle()

  if (resource?.listing_id) {
    const { data: linked } = await admin
      .from('marketplace_listings')
      .select('id, price_ghs, is_free, status, title')
      .eq('id', resource.listing_id)
      .maybeSingle()
    if (linked) return linked
  }

  if (resource?.title) {
    const { data: byTitle } = await admin
      .from('marketplace_listings')
      .select('id, price_ghs, is_free, status, title')
      .eq('title', resource.title)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (byTitle) return byTitle
  }

  return null
}

export async function resolvePaymentAmount(
  intentType: PaymentIntentType,
  payload: PaymentPayload
): Promise<{ ok: true; amountGhs: number; amountPesewas: number; resolvedListingId?: string } | { ok: false; error: string }> {
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
    const listing = await resolveMarketplaceListingForCheckout(payload.listingId)

    if (!listing || listing.status !== 'approved') {
      return { ok: false, error: 'That listing is not available for purchase.' }
    }
    if (listing.is_free) return { ok: false, error: 'This resource is free. Import it instead.' }

    const amountGhs = Number(listing.price_ghs ?? 0)
    if (amountGhs <= 0) return { ok: false, error: 'That listing has no price set.' }
    return {
      ok: true,
      amountGhs,
      amountPesewas: Math.round(amountGhs * 100),
      resolvedListingId: listing.id,
    }
  }

  if (intentType === 'institution_deposit') {
    const amountGhs = resolveInstitutionOnboardingDepositGhs()
    return { ok: true, amountGhs, amountPesewas: Math.round(amountGhs * 100) }
  }

  if (intentType === 'credit_pack' && payload.creditPackId) {
    const pack = findCreditPack(payload.creditPackId)
    if (!pack) return { ok: false, error: 'That credit pack is not available.' }
    return { ok: true, amountGhs: pack.priceGhs, amountPesewas: Math.round(pack.priceGhs * 100) }
  }

  return { ok: false, error: 'Invalid checkout request.' }
}
