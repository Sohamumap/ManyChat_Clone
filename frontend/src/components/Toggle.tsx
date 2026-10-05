import { cn } from '../lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  /** Visually hidden label when no visible text is wanted. */
  srLabel?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function Toggle({ checked, onChange, label, srLabel, description, disabled, size = 'md', className }: ToggleProps) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const knob = size === 'sm' ? 'size-4' : 'size-5'
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5'
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : srLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        track,
        checked ? 'bg-indigo-600' : 'bg-slate-300',
      )}
    >
      <span
        aria-hidden
        className={cn('rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform', knob, checked ? shift : 'translate-x-0')}
      />
    </button>
  )
  if (!label) return <span className={cn('inline-flex', className)}>{button}</span>
  return (
    <label className={cn('inline-flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}>
      {button}
      <span className="min-w-0 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-slate-500">{description}</span>}
      </span>
    </label>
  )
}
