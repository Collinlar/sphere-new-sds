import { SVGAttributes } from 'react'

type IconProps = SVGAttributes<SVGSVGElement> & { size?: number }

function base(size: number, props: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', ...props }
}

export function IconLock({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="5" y="11" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 11V8a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconMail({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="6" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconCheck({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCheckCircle({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="7" cy="7" r="6.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconXCircle({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="7" cy="7" r="6.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconInfo({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function IconFlag({ size = 12, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M7 3v5M7 10v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="12" width="8" height="1.5" rx="0.5" fill="currentColor" />
    </svg>
  )
}

export function IconSearch({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IconDocument({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="4" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 9h6M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlay({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polygon points="5,3 14,7 5,11" fill="currentColor" fillOpacity="0.85" />
    </svg>
  )
}

export function IconTeams({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="1" y="7" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="7" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function IconUser({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 12c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconClose({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
