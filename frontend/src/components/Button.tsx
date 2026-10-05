import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../lib/utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'subtle'
export type ButtonSize = 'xs' | 'sm' | 'md'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-300 border border-transparent',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:text-slate-400 disabled:bg-white',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent disabled:text-slate-300',
  subtle: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-transparent disabled:opacity-50',
  danger:
    'bg-red-600 text-white shadow-xs hover:bg-red-500 active:bg-red-700 disabled:bg-red-300 border border-transparent',
  'danger-ghost': 'text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent disabled:text-red-300',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

const iconSizes: Record<ButtonSize, string> = {
  xs: 'size-7 rounded-md',
  sm: 'size-8 rounded-lg',
  md: 'size-10 rounded-lg',
}

/** Square icon-only button with an accessible label. */
export function IconButton({
  label,
  children,
  className,
  variant = 'ghost',
  size = 'sm',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center p-0 transition-colors select-none disabled:cursor-not-allowed [&>svg]:shrink-0',
        variants[variant],
        iconSizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
