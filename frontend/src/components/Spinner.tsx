import { LoaderCircle } from 'lucide-react'
import { cn } from '../lib/utils'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <LoaderCircle className={cn('size-4 animate-spin text-current', className)} aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

/** Centered spinner for a page or card body. */
export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16 text-sm text-slate-500', className)}>
      <Spinner label={label} className="size-5 text-indigo-500" />
    </div>
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <Spinner className="size-6 text-indigo-500" />
    </div>
  )
}
