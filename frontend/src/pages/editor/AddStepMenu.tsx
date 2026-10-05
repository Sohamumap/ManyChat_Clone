import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { STEP_TYPE_DESCRIPTIONS, STEP_TYPE_LABELS, STEP_TYPE_ORDER } from '../../lib/flow'
import { cn } from '../../lib/utils'
import type { StepType } from '../../types'
import { STEP_COLORS, STEP_ICONS } from './stepMeta'

export function AddStepMenu({ onAdd, disabled }: { onAdd: (type: StepType) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="subtle"
        icon={<Plus className="size-4" />}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Add step
      </Button>
      {open && (
        <div
          role="menu"
          className="animate-pop-in absolute bottom-full left-0 z-30 mb-2 w-[18rem] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-900/10"
        >
          {STEP_TYPE_ORDER.map((type) => {
            const Icon = STEP_ICONS[type]
            return (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => {
                  onAdd(type)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', STEP_COLORS[type])}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{STEP_TYPE_LABELS[type]}</span>
                  <span className="block text-xs text-slate-500">{STEP_TYPE_DESCRIPTIONS[type]}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
