import { useState } from 'react'
import { cn, initials } from '../lib/utils'

const palettes = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({
  src,
  name,
  username,
  size = 36,
  className,
}: {
  src?: string | null
  name?: string | null
  username?: string | null
  size?: number
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const label = name || username || '?'
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-900/5', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        palettes[hash(label) % palettes.length],
        className,
      )}
    >
      {initials(name, username)}
    </span>
  )
}
