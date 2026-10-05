import { stepOptionLabel } from '../../lib/flow'
import { cn } from '../../lib/utils'
import type { Step } from '../../types'

interface StepSelectProps {
  value: string | null | undefined
  onChange: (id: string | null) => void
  steps: Step[]
  /** Step that owns this dropdown (excluded from the options). */
  selfId?: string
  /** Label for the empty option ("End flow" or "Choose a step…"). */
  emptyLabel?: string
  /** When true, the empty option can't be picked once something is chosen (used for button targets). */
  required?: boolean
  invalid?: boolean
  id?: string
  className?: string
  ariaLabel?: string
}

export function StepSelect({
  value,
  onChange,
  steps,
  selfId,
  emptyLabel = 'End flow',
  required = false,
  invalid,
  id,
  className,
  ariaLabel,
}: StepSelectProps) {
  const current = value ?? ''
  const missing = current && !steps.some((s) => s.id === current)
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={current}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn('input', (invalid || missing || (required && !current)) && 'input-error', className)}
    >
      <option value="" disabled={required && !!current}>
        {emptyLabel}
      </option>
      {steps.map((s, i) =>
        s.id === selfId ? null : (
          <option key={s.id} value={s.id}>
            {stepOptionLabel(s, i)}
          </option>
        ),
      )}
      {missing && <option value={current}>(deleted step)</option>}
    </select>
  )
}
