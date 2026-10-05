import { ArrowDown, ArrowUp, CircleAlert, Flag, ImageOff, Info, Trash2, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { IconButton } from '../../components/Button'
import { ChipInput } from '../../components/ChipInput'
import { Counter, Field } from '../../components/Field'
import { LIMITS, STEP_TYPE_LABELS, type Issue } from '../../lib/flow'
import { charCount, cn } from '../../lib/utils'
import type {
  AddTagStep,
  CardStep,
  CollectInputStep,
  DelayStep,
  FollowCheckStep,
  InputType,
  MessageStep,
  Step,
} from '../../types'
import { ButtonsEditor } from './ButtonsEditor'
import { PlaceholderTextarea } from './PlaceholderTextarea'
import { StepSelect } from './StepSelect'
import { STEP_COLORS, STEP_ICONS } from './stepMeta'

interface StepCardProps {
  step: Step
  index: number
  steps: Step[]
  isStart: boolean
  isFirst: boolean
  isLast: boolean
  canDelete: boolean
  issues: Issue[]
  showErrors: boolean
  onChange: (step: Step) => void
  onMove: (dir: -1 | 1) => void
  onSetStart: () => void
  onDelete: () => void
}

export function StepCard({
  step,
  index,
  steps,
  isStart,
  isFirst,
  isLast,
  canDelete,
  issues,
  showErrors,
  onChange,
  onMove,
  onSetStart,
  onDelete,
}: StepCardProps) {
  const Icon = STEP_ICONS[step.type]
  const visible = issues.filter((i) => i.always || showErrors)
  const errors = visible.filter((i) => i.level === 'error')
  const warnings = visible.filter((i) => i.level === 'warning')
  const common = { steps, showErrors }

  return (
    <div
      id={`step-${step.id}`}
      className={cn(
        'scroll-mt-32 rounded-xl border bg-white shadow-xs transition-shadow',
        errors.length ? 'border-red-300' : isStart ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200',
      )}
    >
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums">
          {index + 1}
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset',
            STEP_COLORS[step.type],
          )}
        >
          <Icon className="size-3.5" />
          {STEP_TYPE_LABELS[step.type]}
        </span>
        {isStart && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">
            <Flag className="size-3" />
            Start
          </span>
        )}
        <input
          value={step.label}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
          placeholder="Add a label…"
          aria-label={`Step ${index + 1} label`}
          className="order-last min-w-0 basis-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none sm:order-none sm:basis-auto sm:flex-1"
        />
        <div className="ml-auto flex items-center gap-0.5">
          {!isStart && (
            <IconButton label="Set as start step" onClick={onSetStart}>
              <Flag className="size-4" />
            </IconButton>
          )}
          <IconButton label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={isLast} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton
            label={canDelete ? 'Delete step' : 'A flow needs at least one step'}
            variant="danger-ghost"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {/* body */}
      <div className="space-y-4 px-3 py-4 sm:px-4">
        {step.type === 'message' && <MessageFields step={step} onChange={onChange} {...common} />}
        {step.type === 'card' && <CardFields step={step} onChange={onChange} {...common} />}
        {step.type === 'delay' && <DelayFields step={step} onChange={onChange} {...common} />}
        {step.type === 'follow_check' && <FollowCheckFields step={step} onChange={onChange} {...common} />}
        {step.type === 'collect_input' && <CollectInputFields step={step} onChange={onChange} {...common} />}
        {step.type === 'add_tag' && <AddTagFields step={step} onChange={onChange} {...common} />}

        {(errors.length > 0 || warnings.length > 0) && (
          <div className="space-y-2">
            {errors.map((issue, i) => (
              <p key={`e${i}`} className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{stripStepPrefix(issue.message)}</span>
              </p>
            ))}
            {warnings.map((issue, i) => (
              <p key={`w${i}`} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{stripStepPrefix(issue.message)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Inline messages don't need the "Step #2 (Label): " prefix used in the summary box. */
function stripStepPrefix(message: string): string {
  const m = message.replace(/^Step #\d+( \([^)]*\))?: /, '')
  return m.charAt(0).toUpperCase() + m.slice(1)
}

// ------------------------------------------------------------------ per-type fields

interface FieldsProps<S extends Step> {
  step: S
  onChange: (step: Step) => void
  steps: Step[]
  showErrors: boolean
}

type LinearStep = Exclude<Step, FollowCheckStep>

function NextSelect<S extends LinearStep>({
  step,
  steps,
  onChange,
  label = 'Then',
}: {
  step: S
  steps: Step[]
  onChange: (s: Step) => void
  label?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 border-t border-dashed border-slate-200 pt-4 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="shrink-0 text-sm font-medium text-slate-700 sm:w-24">
        {label}
      </label>
      <StepSelect
        id={id}
        value={step.next_step_id}
        onChange={(next) => onChange({ ...step, next_step_id: next })}
        steps={steps}
        selfId={step.id}
        className="sm:flex-1"
      />
    </div>
  )
}

function MessageFields({ step, onChange, steps, showErrors }: FieldsProps<MessageStep>) {
  const id = useId()
  const limit = step.buttons.length ? LIMITS.textBytesWithButtons : LIMITS.textBytes
  return (
    <>
      <PlaceholderTextarea
        id={id}
        label="Message"
        value={step.text}
        onChange={(text) => onChange({ ...step, text })}
        limit={limit}
        rows={3}
        placeholder="Hey {first_name}! Thanks for reaching out…"
        invalid={showErrors && !step.text.trim()}
      />
      <ButtonsEditor
        buttons={step.buttons}
        onChange={(buttons) => onChange({ ...step, buttons })}
        steps={steps}
        selfId={step.id}
        showErrors={showErrors}
      />
      <NextSelect step={step} steps={steps} onChange={onChange} />
    </>
  )
}

function CardFields({ step, onChange, steps, showErrors }: FieldsProps<CardStep>) {
  const id = useId()
  const [broken, setBroken] = useState<string | null>(null)
  const url = step.image_url.trim()
  const urlInvalid = !!url && !url.startsWith('https://')
  const titleLen = charCount(step.title)
  const subLen = charCount(step.subtitle)
  return (
    <>
      <Field
        label="Image URL"
        htmlFor={`${id}-img`}
        error={urlInvalid ? 'Must start with https://' : showErrors && !url ? 'Add an image URL' : undefined}
        hint="A public https:// image. Instagram shows it at a 1.91:1 ratio."
      >
        <div className="flex items-start gap-3">
          <input
            id={`${id}-img`}
            type="url"
            inputMode="url"
            value={step.image_url}
            onChange={(e) => onChange({ ...step, image_url: e.target.value })}
            placeholder="https://…/image.jpg"
            className={cn('input min-w-0 flex-1', (urlInvalid || (showErrors && !url)) && 'input-error')}
          />
          <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {url && !urlInvalid && broken !== url ? (
              <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(url)} referrerPolicy="no-referrer" />
            ) : (
              <ImageOff className="size-4 text-slate-300" />
            )}
          </div>
        </div>
      </Field>
      <Field
        label="Title"
        htmlFor={`${id}-title`}
        counter={<Counter value={titleLen} max={LIMITS.cardTitle} />}
        error={showErrors && !step.title.trim() ? 'Add a title' : undefined}
      >
        <input
          id={`${id}-title`}
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          placeholder="Free guide: 10 tips to grow on Instagram"
          className={cn('input', (titleLen > LIMITS.cardTitle || (showErrors && !step.title.trim())) && 'input-error')}
        />
      </Field>
      <Field label="Subtitle" optional htmlFor={`${id}-sub`} counter={<Counter value={subLen} max={LIMITS.cardSubtitle} />}>
        <input
          id={`${id}-sub`}
          value={step.subtitle}
          onChange={(e) => onChange({ ...step, subtitle: e.target.value })}
          placeholder="Tap below to get it"
          className={cn('input', subLen > LIMITS.cardSubtitle && 'input-error')}
        />
      </Field>
      <ButtonsEditor
        buttons={step.buttons}
        onChange={(buttons) => onChange({ ...step, buttons })}
        steps={steps}
        selfId={step.id}
        showErrors={showErrors}
      />
      <NextSelect step={step} steps={steps} onChange={onChange} />
    </>
  )
}

type DelayUnit = 'seconds' | 'minutes' | 'hours'
const UNIT_SECONDS: Record<DelayUnit, number> = { seconds: 1, minutes: 60, hours: 3600 }

function initialUnit(seconds: number): DelayUnit {
  if (seconds > 0 && seconds % 3600 === 0) return 'hours'
  if (seconds > 0 && seconds % 60 === 0) return 'minutes'
  return 'seconds'
}

function DelayFields({ step, onChange, steps }: FieldsProps<DelayStep>) {
  const id = useId()
  const [unit, setUnit] = useState<DelayUnit>(() => initialUnit(step.seconds))
  const [amount, setAmount] = useState(() => String(step.seconds / UNIT_SECONDS[initialUnit(step.seconds)]))

  const apply = (rawAmount: string, u: DelayUnit) => {
    const n = Number(rawAmount)
    const seconds = rawAmount.trim() === '' || !Number.isFinite(n) ? 0 : Math.round(n * UNIT_SECONDS[u])
    onChange({ ...step, seconds })
  }

  const outOfRange = step.seconds < LIMITS.delayMin || step.seconds > LIMITS.delayMax
  return (
    <>
      <Field
        label="Wait for"
        htmlFor={id}
        error={outOfRange ? 'Choose a delay between 1 second and 23 hours' : undefined}
        hint="The next step is sent after this delay."
      >
        <div className="flex gap-2">
          <input
            id={id}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              apply(e.target.value, unit)
            }}
            className={cn('input w-28', outOfRange && 'input-error')}
          />
          <select
            aria-label="Unit"
            value={unit}
            onChange={(e) => {
              const u = e.target.value as DelayUnit
              setUnit(u)
              apply(amount, u)
            }}
            className="input w-36"
          >
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
          </select>
        </div>
      </Field>
      <NextSelect step={step} steps={steps} onChange={onChange} />
    </>
  )
}

function FollowCheckFields({ step, onChange, steps }: FieldsProps<FollowCheckStep>) {
  const id = useId()
  return (
    <>
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        Only works after the person tapped a button or replied (Instagram needs their consent to check).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={<span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />If following →</span>} htmlFor={`${id}-yes`}>
          <StepSelect
            id={`${id}-yes`}
            value={step.following_step_id}
            onChange={(v) => onChange({ ...step, following_step_id: v })}
            steps={steps}
            selfId={step.id}
          />
        </Field>
        <Field label={<span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" />If not following →</span>} htmlFor={`${id}-no`}>
          <StepSelect
            id={`${id}-no`}
            value={step.not_following_step_id}
            onChange={(v) => onChange({ ...step, not_following_step_id: v })}
            steps={steps}
            selfId={step.id}
          />
        </Field>
      </div>
    </>
  )
}

const INPUT_TYPES: { value: InputType; label: string; hint: string }[] = [
  { value: 'email', label: 'Email', hint: 'Saved to the contact’s email. Instagram suggests their email as a quick reply.' },
  { value: 'phone', label: 'Phone', hint: 'Saved to the contact’s phone. Instagram suggests their number as a quick reply.' },
  { value: 'text', label: 'Text', hint: 'Any answer, saved as a custom field on the contact.' },
]

function CollectInputFields({ step, onChange, steps, showErrors }: FieldsProps<CollectInputStep>) {
  const id = useId()
  const type = INPUT_TYPES.find((t) => t.value === step.input_type) ?? INPUT_TYPES[0]
  const fieldMissing = step.input_type === 'text' && !(step.field_name ?? '').trim()
  return (
    <>
      <PlaceholderTextarea
        id={`${id}-q`}
        label="Question"
        value={step.text}
        onChange={(text) => onChange({ ...step, text })}
        limit={LIMITS.textBytes}
        rows={2}
        placeholder="What's the best email to send it to?"
        invalid={showErrors && !step.text.trim()}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expected answer" htmlFor={`${id}-type`} hint={type.hint}>
          <select
            id={`${id}-type`}
            value={step.input_type}
            onChange={(e) => {
              const input_type = e.target.value as InputType
              onChange({ ...step, input_type, field_name: input_type === 'text' ? (step.field_name ?? '') : null })
            }}
            className="input"
          >
            {INPUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        {step.input_type === 'text' && (
          <Field
            label="Save answer as field"
            htmlFor={`${id}-field`}
            error={showErrors && fieldMissing ? 'Give the answer a field name' : undefined}
            hint="e.g. company, city, budget"
          >
            <input
              id={`${id}-field`}
              value={step.field_name ?? ''}
              onChange={(e) => onChange({ ...step, field_name: e.target.value })}
              placeholder="company"
              className={cn('input font-mono', showErrors && fieldMissing && 'input-error')}
            />
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field
          label="If the answer is invalid, reply"
          htmlFor={`${id}-retry`}
          error={showErrors && !step.retry_text.trim() ? 'Write a retry message' : undefined}
        >
          <input
            id={`${id}-retry`}
            value={step.retry_text}
            onChange={(e) => onChange({ ...step, retry_text: e.target.value })}
            className={cn('input', showErrors && !step.retry_text.trim() && 'input-error')}
          />
        </Field>
        <Field label="Max attempts" htmlFor={`${id}-max`}>
          <input
            id={`${id}-max`}
            type="number"
            min={LIMITS.maxAttemptsMin}
            max={LIMITS.maxAttemptsMax}
            value={Number.isFinite(step.max_attempts) ? step.max_attempts : ''}
            onChange={(e) => onChange({ ...step, max_attempts: e.target.value === '' ? NaN : Math.round(Number(e.target.value)) })}
            className={cn(
              'input',
              !(step.max_attempts >= LIMITS.maxAttemptsMin && step.max_attempts <= LIMITS.maxAttemptsMax) && 'input-error',
            )}
          />
        </Field>
      </div>
      <NextSelect step={step} steps={steps} onChange={onChange} />
    </>
  )
}

function AddTagFields({ step, onChange, steps, showErrors }: FieldsProps<AddTagStep>) {
  const id = useId()
  const missing = !step.tags.some((t) => t.trim())
  return (
    <>
      <Field
        label="Tags to add"
        htmlFor={id}
        error={showErrors && missing ? 'Add at least one tag' : undefined}
        hint="Press Enter or comma to add. Tags show up on the contact and can be used to filter contacts."
      >
        <ChipInput
          id={id}
          value={step.tags}
          onChange={(tags) => onChange({ ...step, tags })}
          placeholder="lead, vip…"
          invalid={showErrors && missing}
        />
      </Field>
      <NextSelect step={step} steps={steps} onChange={onChange} />
    </>
  )
}
