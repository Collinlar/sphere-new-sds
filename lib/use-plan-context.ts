'use client'

import { useEffect, useState } from 'react'
import { getPlanContext, type PlanContext } from './plan-privileges'

const DEFAULT_CONTEXT: PlanContext = {
  planId: 'membership',
  canSellMarketplace: false,
  canIssueCertificates: false,
  isSphereStaff: false,
  sessionStudentCap: 5,
  enrolledStudentCap: null,
  effectiveModules: ['engage', 'assess'],
}

export function usePlanContext() {
  const [context, setContext] = useState<PlanContext>(DEFAULT_CONTEXT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlanContext()
      .then(setContext)
      .finally(() => setLoading(false))
  }, [])

  return { ...context, loading }
}
