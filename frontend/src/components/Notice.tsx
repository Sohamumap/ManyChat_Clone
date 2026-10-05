import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

const styles: Record<NoticeTone, { box: string; icon: ReactNode; title: string }> = {
  info: {
    box: 'bg-indigo-50/70 border-indigo-200 text-indigo-900',
    icon: <Info className="size-4 text-indigo-500" />,
    title: 'text-indigo-900',
  },
  success: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: <CircleCheck className="size-4 text-emerald-600" />,
    title: 'text-emerald-900',
  },
  warning: {
    box: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: <TriangleAlert className="size-4 text-amber-600" />,
    title: 'text-amber-900',
  },
  error: {
    box: 'bg-red-50 border-red-200 text-red-800',
    icon: <CircleAlert className="size-4 text-red-600" />,
    title: 'text-red-900',
  },
}

/** Inline banner for errors, warnings and hints. */
export function Notice({
  tone = 'info',
  title,
  children,
  onDismiss,
  action,
  className,
}: {
  tone?: NoticeTone
  title?: ReactNode
  children?: ReactNode
  onDismiss?: () => void
  action?: ReactNode
  className?: string
}) {
  const s = styles[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', s.box, className)}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 break-words">
        {title && <p className={cn('font-semibold', s.title)}>{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : undefined, 'opacity-90')}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Error box with an optional retry button. */
export function ErrorNotice({ error, onRetry, className }: { error: string; onRetry?: () => void; className?: string }) {
  return (
    <Notice
      tone="error"
      className={className}
      title="Couldn't load this"
      action={
        onRetry ? (
          <button type="button" onClick={onRetry} className="text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-900">
            Try again
          </button>
        ) : undefined
      }
    >
      {error}
    </Notice>
  )
}
