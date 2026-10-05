import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

/** Label + control + hint/error, with an optional counter on the right of the label. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  counter,
  children,
  className,
  optional,
}: {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  counter?: ReactNode
  children: ReactNode
  className?: string
  optional?: boolean
}) {
  return (
    <div className={className}>
      {(label || counter) && (
        <div className="mb-1.5 flex items-end justify-between gap-2">
          {label ? (
            <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
              {label}
              {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
            </label>
          ) : (
            <span />
          )}
          {counter}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

/** "12 / 20" counter that turns red past the limit. */
export function Counter({ value, max, unit }: { value: number; max: number; unit?: string }) {
  const over = value > max
  const near = !over && value > max * 0.9
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        over ? 'font-semibold text-red-600' : near ? 'text-amber-600' : 'text-slate-400',
      )}
    >
      {value} / {max}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}
