import { Braces } from 'lucide-react'
import { useRef } from 'react'
import { Counter } from '../../components/Field'
import { PLACEHOLDERS } from '../../lib/flow'
import { cn, utf8Bytes } from '../../lib/utils'

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Byte limit shown in the counter (UTF-8, like Instagram). */
  limit: number
  rows?: number
  placeholder?: string
  label?: string
  invalid?: boolean
  hint?: string
}

/** Textarea with a UTF-8 byte counter and chips that insert {placeholders} at the cursor. */
export function PlaceholderTextarea({ id, value, onChange, limit, rows = 3, placeholder, label, invalid, hint }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const bytes = utf8Bytes(value)

  const insert = (token: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    const caret = start + token.length
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : (
          <span />
        )}
        <Counter value={bytes} max={limit} unit="bytes" />
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn('input min-h-[5rem] resize-y leading-relaxed', (invalid || bytes > limit) && 'input-error')}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Braces className="size-3.5" />
          Insert
        </span>
        {PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            // keep the textarea's selection: don't steal focus on mousedown
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(p)}
            className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200"
          >
            {p}
          </button>
        ))}
        {hint && <span className="ml-auto text-xs text-slate-400">{hint}</span>}
      </div>
    </div>
  )
}
