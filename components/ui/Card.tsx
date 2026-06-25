import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: string
}

export default function Card({ className, style, padding = '20px', children, ...props }: CardProps) {
  return (
    <div
      className={cn('sphere-card', className)}
      style={{ padding, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
