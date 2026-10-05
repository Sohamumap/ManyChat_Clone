/** Parse an API timestamp. Naive ISO strings (no zone) are treated as UTC, as documented. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  let s = value.trim()
  // "2026-10-05T12:00:00" or "2026-10-05 12:00:00" without a zone -> UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = s.replace(' ', 'T') + 'Z'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

function span(seconds: number): string {
  if (seconds < MINUTE) return `${Math.max(1, Math.floor(seconds))}s`
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h`
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d`
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)}w`
  if (seconds < YEAR) return `${Math.floor(seconds / MONTH)}mo`
  return `${Math.floor(seconds / YEAR)}y`
}

/** "just now", "3m ago", "in 2d". */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = value instanceof Date ? value : parseDate(value)
  if (!d) return '—'
  const diff = (now.getTime() - d.getTime()) / 1000
  if (Math.abs(diff) < 45) return 'just now'
  return diff > 0 ? `${span(diff)} ago` : `in ${span(-diff)}`
}

/** Whole days from now until the date (negative when in the past). */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDate(value)
  if (!d) return null
  return (d.getTime() - now.getTime()) / (DAY * 1000)
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Human duration for a number of seconds: "90 seconds" -> "1 min 30 s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 s'
  const h = Math.floor(seconds / HOUR)
  const m = Math.floor((seconds % HOUR) / MINUTE)
  const s = Math.floor(seconds % MINUTE)
  const parts: string[] = []
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} min`)
  if (s) parts.push(`${s} s`)
  return parts.join(' ')
}
