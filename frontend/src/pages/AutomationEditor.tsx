import { ArrowLeft, CircleAlert, LayoutTemplate, Save, Workflow } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { RunStatusBadge } from '../components/Badge'
import { Button, ButtonLink } from '../components/Button'
import { Card, CardBody } from '../components/Card'
import { Field } from '../components/Field'
import { RequireAccount } from '../components/Layout'
import { Modal, useConfirm } from '../components/Modal'
import { ErrorNotice, Notice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { LoadingBlock } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { Toggle } from '../components/Toggle'
import {
  LIMITS,
  automationToDraft,
  createStep,
  draftToPayload,
  newStepId,
  removeStep,
  validateDraft,
  type EditorDraft,
  type Issue,
  type TriggerDraft,
} from '../lib/flow'
import { useAsync } from '../lib/hooks'
import { timeAgo } from '../lib/time'
import type { AutomationTemplate } from '../lib/templates'
import { cn, formatNumber } from '../lib/utils'
import type { Automation, AutomationStats, Step, StepType } from '../types'
import { AddStepMenu } from './editor/AddStepMenu'
import { StepCard } from './editor/StepCard'
import { TemplateGrid } from './editor/TemplatePicker'
import { TriggerCard } from './editor/TriggerCard'

export default function AutomationEditorPage() {
  const { id } = useParams()
  if (!id) {
    return <RequireAccount>{(accountId) => <NewAutomation accountId={accountId} />}</RequireAccount>
  }
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return <ErrorNotice error="This automation doesn't exist." />
  }
  return <EditAutomation key={numericId} id={numericId} />
}

// ------------------------------------------------------------------ new: pick a template first

function NewAutomation({ accountId }: { accountId: number }) {
  const [initial, setInitial] = useState<EditorDraft | null>(null)

  if (initial) return <Editor initial={initial} accountId={accountId} />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink />}
        title="New automation"
        description="Pick a starting point. You can change everything in the next step."
      />
      <TemplateGrid onPick={(t) => setInitial(t.build())} />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/automations" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
      <ArrowLeft className="size-4" />
      Automations
    </Link>
  )
}

// ------------------------------------------------------------------ edit: load the automation

function EditAutomation({ id }: { id: number }) {
  const automation = useAsync(() => api.automations.get(id), [id])
  const stats = useAsync(() => api.automations.stats(id), [id])

  if (automation.loading) return <LoadingBlock label="Loading automation…" />
  if (automation.error || !automation.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={<BackLink />} title="Edit automation" />
        <ErrorNotice error={automation.error ?? 'Not found'} onRetry={() => void automation.reload()} />
      </div>
    )
  }
  return (
    <Editor
      initial={automationToDraft(automation.data)}
      accountId={automation.data.account_id}
      automation={automation.data}
      stats={stats.data}
      statsError={stats.error}
    />
  )
}

// ------------------------------------------------------------------ the editor

interface EditorProps {
  initial: EditorDraft
  accountId: number
  automation?: Automation
  stats?: AutomationStats
  statsError?: string | null
}

function Editor({ initial, accountId, automation, stats, statsError }: EditorProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState<EditorDraft>(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [scrollTo, setScrollTo] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const savedSnapshot = useRef(JSON.stringify(initial))
  const allowLeave = useRef(false)

  const dirty = useMemo(() => JSON.stringify(draft) !== savedSnapshot.current, [draft])
  const issues = useMemo(() => validateDraft(draft), [draft])
  const errors = issues.filter((i) => i.level === 'error')
  const { flow } = draft

  // ---- unsaved changes guard
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ---- scroll a newly added step into view
  useEffect(() => {
    if (!scrollTo) return
    const el = document.getElementById(`step-${scrollTo}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector<HTMLElement>('textarea, input:not([aria-label$="label"]), select')?.focus({ preventScroll: true })
    }
    setScrollTo(null)
  }, [scrollTo])

  // ---- mutations
  const patchTrigger = useCallback(
    (patch: Partial<TriggerDraft>) => setDraft((d) => ({ ...d, trigger: { ...d.trigger, ...patch } })),
    [],
  )

  const updateStep = useCallback(
    (step: Step) =>
      setDraft((d) => ({ ...d, flow: { ...d.flow, steps: d.flow.steps.map((s) => (s.id === step.id ? step : s)) } })),
    [],
  )

  const moveStep = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const steps = [...d.flow.steps]
      const target = index + dir
      if (target < 0 || target >= steps.length) return d
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...d, flow: { ...d.flow, steps } }
    })

  const setStart = (id: string) => setDraft((d) => ({ ...d, flow: { ...d.flow, start_step_id: id } }))

  const deleteStep = async (step: Step, index: number) => {
    const referenced = flow.steps.some(
      (s) =>
        s.id !== step.id &&
        ((s.type === 'follow_check' && (s.following_step_id === step.id || s.not_following_step_id === step.id)) ||
          ('next_step_id' in s && s.next_step_id === step.id) ||
          ((s.type === 'message' || s.type === 'card') && s.buttons.some((b) => b.type === 'step' && b.step_id === step.id))),
    )
    const ok = await confirm({
      title: `Delete step #${index + 1}?`,
      message: referenced
        ? 'Other steps point to this one. Those buttons and links will be cleared (set to “End flow”).'
        : 'This step will be removed from the flow.',
      confirmLabel: 'Delete step',
      danger: true,
    })
    if (ok) setDraft((d) => ({ ...d, flow: removeStep(d.flow, step.id) }))
  }

  const addStep = (type: StepType) => {
    const id = newStepId(flow.steps.map((s) => s.id))
    setDraft((d) => {
      const steps = [...d.flow.steps, createStep(type, id)]
      // New steps are never auto-linked; only an empty flow gets a start step automatically.
      return { ...d, flow: { start_step_id: d.flow.steps.length ? d.flow.start_step_id : id, steps } }
    })
    setScrollTo(id)
  }

  const loadTemplate = async (t: AutomationTemplate) => {
    setTemplatesOpen(false)
    const ok = await confirm({
      title: `Load “${t.name}”?`,
      message: 'This replaces all steps in the current flow. The name and trigger settings stay as they are.',
      confirmLabel: 'Replace flow',
      danger: true,
    })
    if (ok) setDraft((d) => ({ ...d, flow: t.build().flow }))
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const save = async () => {
    setShowErrors(true)
    setServerError(null)
    if (errors.length) {
      scrollTop()
      return
    }
    setSaving(true)
    try {
      const payload = draftToPayload(draft, accountId)
      if (automation) await api.automations.update(automation.id, payload)
      else await api.automations.create(payload)
      allowLeave.current = true
      toast.success(automation ? 'Automation saved' : 'Automation created')
      navigate('/automations')
    } catch (err) {
      setServerError(errorMessage(err))
      setSaving(false)
      scrollTop()
    }
  }

  const issuesByStep = useMemo(() => {
    const map = new Map<string, Issue[]>()
    for (const issue of issues) {
      if (!issue.stepId) continue
      map.set(issue.stepId, [...(map.get(issue.stepId) ?? []), issue])
    }
    return map
  }, [issues])

  const triggerIssues = issues.filter((i) => i.section === 'trigger')
  const nameIssue = showErrors ? issues.find((i) => i.section === 'name') : undefined
  const flowIssues = issues.filter((i) => i.section === 'flow' && (i.always || showErrors))

  return (
    <div>
      {/* sticky action bar */}
      <div className="sticky top-14 z-10 -mx-4 -mt-6 mb-6 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/automations"
            aria-label="Back to automations"
            className="-ml-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">
              {automation ? 'Edit automation' : 'New automation'}
              {dirty && <span className="ml-1.5 text-amber-600">· Unsaved changes</span>}
            </p>
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{draft.name.trim() || 'Untitled automation'}</h1>
          </div>
          <Button
            variant="secondary"
            icon={<LayoutTemplate className="size-4" />}
            onClick={() => setTemplatesOpen(true)}
            className="max-sm:w-10 max-sm:px-0"
            aria-label="Load template"
          >
            <span className="max-sm:sr-only">Load template</span>
          </Button>
          <Button variant="primary" icon={<Save className="size-4" />} onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </div>
      </div>

      <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-40 space-y-6">
        {automation && <StatsStrip automation={automation} stats={stats} statsError={statsError ?? null} />}

        {serverError && (
          <Notice tone="error" title="Couldn't save the automation" onDismiss={() => setServerError(null)}>
            {serverError}
          </Notice>
        )}

        {showErrors && errors.length > 0 && (
          <Notice tone="error" title={`Fix ${errors.length === 1 ? 'this problem' : `these ${errors.length} problems`} before saving`}>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {errors.map((issue, i) => (
                <li key={i}>
                  {issue.stepId ? (
                    <button
                      type="button"
                      className="text-left underline decoration-red-300 underline-offset-2 hover:decoration-red-600"
                      onClick={() => setScrollTo(issue.stepId!)}
                    >
                      {issue.message}
                    </button>
                  ) : (
                    issue.message
                  )}
                </li>
              ))}
            </ul>
          </Notice>
        )}

        {/* basics */}
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field label="Name" htmlFor="automation-name" error={nameIssue?.message} className="min-w-0 flex-1">
              <input
                id="automation-name"
                value={draft.name}
                maxLength={LIMITS.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Free guide giveaway"
                className={cn('input', nameIssue && 'input-error')}
              />
            </Field>
            <div className="flex h-10 items-center sm:pb-0">
              <Toggle
                checked={draft.is_active}
                onChange={(is_active) => setDraft((d) => ({ ...d, is_active }))}
                label={draft.is_active ? 'Active' : 'Paused'}
              />
            </div>
          </CardBody>
        </Card>

        <TriggerCard
          trigger={draft.trigger}
          onChange={patchTrigger}
          accountId={accountId}
          issues={triggerIssues}
          showErrors={showErrors}
        />

        {/* flow */}
        <section aria-labelledby="flow-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Workflow className="size-4" />
              </div>
              <div>
                <h2 id="flow-heading" className="text-[15px] font-semibold text-slate-900">
                  Then…
                </h2>
                <p className="text-sm text-slate-500">
                  {flow.steps.length} {flow.steps.length === 1 ? 'step' : 'steps'} · the <span className="font-medium text-indigo-600">Start</span>{' '}
                  step runs first
                </p>
              </div>
            </div>
          </div>

          {flowIssues.map((issue, i) => (
            <Notice key={i} tone={issue.level === 'error' ? 'error' : 'warning'}>
              {issue.message}
            </Notice>
          ))}

          {flow.steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              steps={flow.steps}
              isStart={step.id === flow.start_step_id}
              isFirst={index === 0}
              isLast={index === flow.steps.length - 1}
              canDelete={flow.steps.length > 1}
              issues={issuesByStep.get(step.id) ?? []}
              showErrors={showErrors}
              onChange={updateStep}
              onMove={(dir) => moveStep(index, dir)}
              onSetStart={() => setStart(step.id)}
              onDelete={() => void deleteStep(step, index)}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <AddStepMenu onAdd={addStep} disabled={flow.steps.length >= LIMITS.steps} />
            <Button variant="primary" icon={<Save className="size-4" />} onClick={() => void save()} loading={saving}>
              Save automation
            </Button>
          </div>
        </section>
      </div>

      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Load a template" size="lg">
        <p className="mb-4">Replaces the steps of this flow. Name and trigger stay unchanged.</p>
        <TemplateGrid compact onPick={(t) => void loadTemplate(t)} />
      </Modal>

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Discard unsaved changes?"
        size="sm"
        footer={
          <>
            <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()} data-autofocus>
              Discard changes
            </Button>
          </>
        }
      >
        You have changes to this automation that haven't been saved.
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------------ stats (edit mode)

function StatsStrip({
  automation,
  stats,
  statsError,
}: {
  automation: Automation
  stats?: AutomationStats
  statsError: string | null
}) {
  const items = [
    { label: 'Triggered', value: stats?.triggered ?? automation.triggered_count },
    { label: 'Comments matched', value: stats?.comments_matched },
    { label: 'DMs sent', value: stats?.dms_sent },
  ]
  const runs = Object.entries(stats?.runs ?? {}).filter(([, n]) => n > 0)
  return (
    <Card>
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        {items.map((it) => (
          <div key={it.label} className="px-3 py-3 sm:px-5">
            <p className="text-xs font-medium text-slate-500">{it.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900">
              {it.value === undefined ? <span className="text-slate-300">—</span> : formatNumber(it.value)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-500 sm:px-5">
        {statsError ? (
          <span className="flex items-center gap-1 text-red-600">
            <CircleAlert className="size-3.5" />
            Stats unavailable: {statsError}
          </span>
        ) : runs.length ? (
          <>
            <span className="font-medium">Runs:</span>
            {runs.map(([status, n]) => (
              <span key={status} className="flex items-center gap-1">
                <RunStatusBadge status={status} />
                <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(n)}</span>
              </span>
            ))}
          </>
        ) : (
          <span>No runs yet</span>
        )}
        <span className="ml-auto">Updated {timeAgo(automation.updated_at)}</span>
        <ButtonLink to={`/activity?tab=runs`} size="xs" variant="ghost">
          View activity
        </ButtonLink>
      </div>
    </Card>
  )
}
