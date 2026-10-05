import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = window.setTimeout(() => setState('idle'), 1800)
    return () => window.clearTimeout(t)
  }, [state])

  return (
    <button
      type="button"
      onClick={async () => setState((await copyText(value)) ? 'copied' : 'failed')}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
        state === 'copied'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : state === 'failed'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        className,
      )}
    >
      {state === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select & copy' : 'Copy'}
    </button>
  )
}

/** Read-only value with a copy button. */
export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="input h-9 min-w-0 flex-1 bg-slate-50 font-mono text-[13px] text-slate-700"
          aria-label={label}
        />
        <CopyButton value={value} />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
