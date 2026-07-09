'use client'

import { useEffect, useState, useCallback } from 'react'
import { SPHERE_PLAN_CHANGE_EVENT } from './auth'
import { getPlanContext, type PlanContext } from './plan-privileges'

const DEFAULT_CONTEXT: PlanContext = {
  planId: 'membership',
  canSellMarketplace: false,
  canIssueCertificates: false,
  isSphereStaff: false,
  sessionStudentCap: 5,
  enrolledStudentCap: null,
  effectiveModules: ['engage'],
}

export function usePlanContext() {
  const [context, setContext] = useState<PlanContext>(DEFAULT_CONTEXT)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    return getPlanContext()
      .then(setContext)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPlanChange = () => {
      reload()
    }
    window.addEventListener(SPHERE_PLAN_CHANGE_EVENT, onPlanChange)
    return () => window.removeEventListener(SPHERE_PLAN_CHANGE_EVENT, onPlanChange)
  }, [reload])

  return { ...context, loading, reload }
}
