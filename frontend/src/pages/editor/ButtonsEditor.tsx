import { ExternalLink, Plus, Trash2, Workflow } from 'lucide-react'
import { useId } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Counter } from '../../components/Field'
import { Segmented } from '../../components/Tabs'
import { LIMITS } from '../../lib/flow'
import { charCount, cn } from '../../lib/utils'
import type { ButtonType, FlowButton, Step } from '../../types'
import { StepSelect } from './StepSelect'

interface Props {
  buttons: FlowButton[]
  onChange: (buttons: FlowButton[]) => void
  steps: Step[]
  selfId: string
  showErrors: boolean
}

export function ButtonsEditor({ buttons, onChange, steps, selfId, showErrors }: Props) {
  const baseId = useId()
  const update = (i: number, patch: Partial<FlowButton>) =>
    onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  const setType = (i: number, type: ButtonType) =>
    update(i, type === 'url' ? { type, url: buttons[i].url ?? '', step_id: null } : { type, step_id: buttons[i].step_id ?? null, url: null })

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Buttons</span>
        <span className="text-xs text-slate-400">
          {buttons.length} / {LIMITS.buttons}
        </span>
      </div>
      {buttons.length > 0 && (
        <ul className="space-y-2">
          {buttons.map((b, i) => {
            const len = charCount(b.title)
            const titleBad = len > LIMITS.buttonTitle || (showErrors && !b.title.trim())
            const urlBad = b.type === 'url' && !!b.url && !/^https?:\/\//i.test(b.url.trim())
            return (
              <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="relative">
                      <input
                        id={`${baseId}-t${i}`}
                        value={b.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="Button title"
                        aria-label={`Button ${i + 1} title`}
                        className={cn('input pr-16', titleBad && 'input-error')}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                        <Counter value={len} max={LIMITS.buttonTitle} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Segmented<ButtonType>
                      ariaLabel={`Button ${i + 1} action`}
                      value={b.type}
                      onChange={(t) => setType(i, t)}
                      options={[
                        { value: 'step', label: 'Go to step', icon: <Workflow className="size-3.5" /> },
                        { value: 'url', label: 'Open link', icon: <ExternalLink className="size-3.5" /> },
                      ]}
                    />
                    <IconButton
                      label={`Remove button ${i + 1}`}
                      variant="danger-ghost"
                      onClick={() => onChange(buttons.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2">
                  {b.type === 'step' ? (
                    <StepSelect
                      ariaLabel={`Button ${i + 1} goes to`}
                      value={b.step_id}
                      onChange={(id) => update(i, { step_id: id })}
                      steps={steps}
                      selfId={selfId}
                      emptyLabel="Choose the step this button opens…"
                      required
                      invalid={showErrors && !b.step_id}
                    />
                  ) : (
                    <>
                      <input
                        type="url"
                        inputMode="url"
                        value={b.url ?? ''}
                        onChange={(e) => update(i, { url: e.target.value })}
                        placeholder="https://example.com"
                        aria-label={`Button ${i + 1} link`}
                        className={cn('input', (urlBad || (showErrors && !b.url?.trim())) && 'input-error')}
                      />
                      {urlBad && <p className="mt-1 text-xs text-red-600">Links must start with https://</p>}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="mt-2 -ml-2 text-indigo-600 hover:text-indigo-700"
        icon={<Plus className="size-4" />}
        disabled={buttons.length >= LIMITS.buttons}
        onClick={() => onChange([...buttons, { title: '', type: 'step', step_id: null }])}
      >
        {buttons.length >= LIMITS.buttons ? 'Maximum 3 buttons' : 'Add button'}
      </Button>
    </div>
  )
}
