/** Join class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const encoder = new TextEncoder()

/** Instagram counts message limits in UTF-8 bytes. */
export function utf8Bytes(text: string): number {
  return encoder.encode(text).length
}

/** Count user-perceived characters (code points), matching Python's len(). */
export function charCount(text: string): number {
  return [...text].length
}

export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return ''
  const chars = [...text]
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : text
}

export function initials(...names: Array<string | null | undefined>): string {
  const source = names.find((n) => n && n.trim()) ?? ''
  const words = source.replace(/^@/, '').trim().split(/[\s._-]+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]]
  return letters.join('').toUpperCase()
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 100_000) {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  }
  return new Intl.NumberFormat().format(n)
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

/** localStorage access that never throws (private mode, blocked storage...). */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
