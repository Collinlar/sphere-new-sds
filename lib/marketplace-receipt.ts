import type { AcquisitionKind } from './acquisition-access'
import { getAcquisitionTakeLabel, getAcquisitionUseHref } from './acquisition-access'

export type MarketplaceFulfillTargetType = 'quiz' | 'exam' | 'course' | 'training_path' | string

export interface MarketplacePurchaseReceipt {
  reference: string
  amountGhs: number
  listingId: string
  listingTitle: string
  purchasedAt: string
  destinationLabel: string
  targetType: MarketplaceFulfillTargetType | null
  targetId: string | null
  useHref: string | null
  useLabel: string | null
}

const TARGET_TO_KIND: Record<string, AcquisitionKind> = {
  quiz: 'quiz',
  exam: 'exam',
  course: 'course',
  training_path: 'path',
}

export function usePathForImportedTarget(
  targetType: string | null | undefined,
  targetId: string | null | undefined,
): { href: string; label: string } | null {
  if (!targetType || !targetId) return null
  const kind = TARGET_TO_KIND[targetType]
  if (!kind) return { href: '/platform/library', label: 'Open my library' }
  return {
    href: getAcquisitionUseHref(kind, targetId),
    label: getAcquisitionTakeLabel(kind),
  }
}

export function formatReceiptAmount(amountGhs: number): string {
  if (!amountGhs) return 'Free'
  return `GH₵ ${amountGhs % 1 === 0 ? amountGhs : amountGhs.toFixed(2)}`
}
