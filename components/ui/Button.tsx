import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  accent?: string
  full?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', accent, full, style, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg cursor-pointer border-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'

    const sizes = {
      sm: 'px-3.5 py-2 text-[13px]',
      md: 'px-5 py-3 text-[15px]',
      lg: 'px-7 py-4 text-[17px]',
    }

    const variants: Record<string, string> = {
      primary: '',
      secondary: 'bg-white text-[#1A1A1A] border border-[#E2DDD3] hover:bg-[#EFE9DD]',
      ghost: 'bg-transparent text-[#5A5A5A] hover:bg-[#EFE9DD]',
      danger: 'bg-[#C03A2A] text-white hover:opacity-90',
    }

    const primaryStyle =
      variant === 'primary'
        ? { background: accent ?? 'var(--amber)', color: '#fff' }
        : {}

    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], variants[variant], full ? 'w-full' : '', className)}
        style={{ ...primaryStyle, ...style }}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
