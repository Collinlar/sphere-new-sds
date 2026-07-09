import { supabase } from './supabase'
import { MARKETPLACE_DEMO_RESOURCES } from './marketplace-seed'

export type CatalogPayload = {
  subject: string | null
  level: string | null
  description: string | null
  content: Record<string, unknown>
}

function catalogFromDemo(resourceId: string): CatalogPayload | null {
  const demo = MARKETPLACE_DEMO_RESOURCES.find((r) => r.id === resourceId)
  if (!demo) return null
  const content = (demo.metadata?.content ?? {}) as Record<string, unknown>
  if (Object.keys(content).length === 0) return null
  return {
    subject: demo.subject ?? null,
    level: demo.level ?? null,
    description: demo.description ?? null,
    content,
  }
}

/** Load importable content for catalog resources (listing.resource_id often points here, not a content row). */
export async function resolveCatalogPayload(resourceId: string): Promise<CatalogPayload | null> {
  const { data: mr } = await supabase
    .from('marketplace_resources')
    .select('subject, level, description, metadata')
    .eq('id', resourceId)
    .maybeSingle()

  if (mr) {
    const metadata = (mr.metadata ?? {}) as Record<string, unknown>
    const content = (metadata.content ?? {}) as Record<string, unknown>
    if (Object.keys(content).length > 0) {
      return {
        subject: (mr.subject as string | null) ?? null,
        level: (mr.level as string | null) ?? null,
        description: (mr.description as string | null) ?? null,
        content,
      }
    }
  }

  return catalogFromDemo(resourceId)
}

/** Merge demo seed content into metadata when the DB row only has stats. */
export function enrichMetadataWithCatalog(
  resourceId: string,
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) }
  const content = (base.content ?? {}) as Record<string, unknown>
  if (Object.keys(content).length > 0) return base
  const demo = catalogFromDemo(resourceId)
  if (!demo) return base
  return { ...base, content: demo.content }
}
