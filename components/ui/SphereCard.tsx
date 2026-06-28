import { CSSProperties, ReactNode } from 'react'

interface SphereCardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: number | string
  noShadow?: boolean
}

export default function SphereCard({ children, style, padding = 20, noShadow }: SphereCardProps) {
  return (
    <div
      style={{
        background: 'var(--white)',
        borderRadius: 12,
        padding,
        boxShadow: noShadow ? 'none' : 'var(--shadow-soft)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
