'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_GRADE_LEVELS, fetchInstitutionLevelsForUser } from './institution-type'

export function useInstitutionLevels() {
  const [levels, setLevels] = useState<string[]>(DEFAULT_GRADE_LEVELS)

  useEffect(() => {
    fetchInstitutionLevelsForUser().then(setLevels)
  }, [])

  return levels
}
