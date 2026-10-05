import { X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../lib/utils'

interface ChipInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  /** Compare case-insensitively when de-duplicating (default true). */
  caseInsensitive?: boolean
  transform?: (chip: string) => string
  invalid?: boolean
  id?: string
  ariaLabel?: string
  disabled?: boolean
}

/** Type and press Enter or comma to add a chip; Backspace on an empty input removes the last one. */
export function ChipInput({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  caseInsensitive = true,
  transform,
  invalid,
  id,
  ariaLabel,
  disabled,
}: ChipInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => (transform ? transform(p.trim()) : p.trim()))
      .filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) {
      const exists = next.some((v) => (caseInsensitive ? v.toLowerCase() === p.toLowerCase() : v === p))
      if (!exists) next.push(p)
    }
    onChange(next)
  }

  const commit = () => {
    if (draft.trim()) add(draft)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-xs transition',
        'focus-within:border-indigo-500 focus-within:ring-3 focus-within:ring-indigo-500/15',
        invalid ? 'border-red-400' : 'border-slate-300',
        disabled && 'bg-slate-50',
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-indigo-50 py-0.5 pr-1 pl-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/15 ring-inset"
        >
          <span className="truncate">{chip}</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${chip}`}
              className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((_, j) => j !== i))
              }}
            >
              <X className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) {
            add(v)
            setDraft('')
          } else setDraft(v)
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (text.includes(',') || text.includes('\n')) {
            e.preventDefault()
            add(text.replace(/\n/g, ','))
          }
        }}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400 focus:ring-0"
      />
    </div>
  )
}
