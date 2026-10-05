import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type BadgeTone = 'gray' | 'indigo' | 'violet' | 'blue' | 'green' | 'amber' | 'red'

const tones: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
}

const dots: Record<BadgeTone, string> = {
  gray: 'bg-slate-400',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export function Badge({
  tone = 'gray',
  dot = false,
  icon,
  className,
  children,
  title,
}: {
  tone?: BadgeTone
  dot?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

const RUN_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  running: { tone: 'blue', label: 'Running' },
  waiting_button: { tone: 'violet', label: 'Waiting for tap' },
  waiting_reply: { tone: 'violet', label: 'Waiting for reply' },
  waiting_input: { tone: 'violet', label: 'Waiting for input' },
  waiting_delay: { tone: 'indigo', label: 'Delayed' },
  completed: { tone: 'green', label: 'Completed' },
  failed: { tone: 'red', label: 'Failed' },
  cancelled: { tone: 'gray', label: 'Cancelled' },
}

const COMMENT_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  matched: { tone: 'green', label: 'Matched' },
  no_match: { tone: 'gray', label: 'No match' },
  skipped_repeat: { tone: 'amber', label: 'Repeat (skipped)' },
  ignored: { tone: 'gray', label: 'Ignored' },
  error: { tone: 'red', label: 'Error' },
}

export function humanize(value: string): string {
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function runStatusLabel(status: string): string {
  return RUN_STATUS[status]?.label ?? humanize(status)
}

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { tone: 'gray' as const, label: humanize(status) }
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  )
}

export function CommentStatusBadge({ status }: { status: string }) {
  const s = COMMENT_STATUS[status] ?? { tone: 'gray' as const, label: humanize(status) }
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  )
}

export function commentStatusLabel(status: string): string {
  return COMMENT_STATUS[status]?.label ?? humanize(status)
}
