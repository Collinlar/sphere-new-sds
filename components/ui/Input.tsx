import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  accent?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, accent = 'var(--amber)', id, ...props }, ref) => {
    return (
      <div className="mb-4">
        {label && (
          <label htmlFor={id} className="block text-[13px] font-medium text-[#6B6870] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full h-12 px-3.5 text-base font-normal rounded-lg outline-none transition-colors',
            className
          )}
          style={{
            background: 'var(--bg2)',
            border: '1px solid transparent',
            color: 'var(--near-black)',
            fontFamily: 'var(--font)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = accent
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'transparent'
          }}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
