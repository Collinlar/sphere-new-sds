'use client'

import { useEffect, useState } from 'react'

// Reports whether the viewport is at or below the given breakpoint.
// Use for cases where the DOM must genuinely restructure on mobile
// (wide tables into cards, multi-panel builders into tabs). For simple
// column collapse and padding, prefer the CSS utility classes in globals.css.
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpointPx])

  return isMobile
}
