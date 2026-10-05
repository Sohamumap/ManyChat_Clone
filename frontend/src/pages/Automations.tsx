import { CopyPlus, MessageCircle, Pencil, Plus, Send, Trash2, Workflow, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { ButtonLink, IconButton } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { RequireAccount } from '../components/Layout'
import { useConfirm } from '../components/Modal'
import { ErrorNotice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { LoadingBlock } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { Toggle } from '../components/Toggle'
import { triggerSummary } from '../lib/flow'
import { useAsync } from '../lib/hooks'
import { timeAgo } from '../lib/time'
import { cn, formatNumber, pluralize } from '../lib/utils'
import type { Automation } from '../types'

export default function AutomationsPage() {
  return <RequireAccount>{(accountId) => <AutomationList accountId={accountId} />}</RequireAccount>
}

function AutomationList({ accountId }: { accountId: number }) {
  const { data, error, loading, reload, setData } = useAsync(() => api.automations.list(accountId), [accountId])
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  const replace = (a: Automation) => setData((list) => list?.map((x) => (x.id === a.id ? a : x)))

  const toggleActive = async (a: Automation) => {
    replace({ ...a, is_active: !a.is_active }) // optimistic
    try {
      replace(await api.automations.setActive(a.id, !a.is_active))
    } catch (err) {
      replace(a)
      toast.error(errorMessage(err))
    }
  }

  const duplicate = async (a: Automation) => {
    setBusy(`dup:${a.id}`)
    try {
      const copy = await api.automations.duplicate(a.id)
      setData((list) => (list ? [...list, copy] : [copy]))
      toast.success(`Duplicated as “${copy.name}”`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (a: Automation) => {
    const ok = await confirm({
      title: `Delete “${a.name}”?`,
      message: 'The automation stops immediately. Contacts and message history are kept.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setBusy(`del:${a.id}`)
    try {
      await api.automations.remove(a.id)
      setData((list) => list?.filter((x) => x.id !== a.id))
      toast.success('Automation deleted')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const list = data ?? []
  const active = list.filter((a) => a.is_active).length

  return (
    <div>
      <PageHeader
        title="Automations"
        description={data ? `${pluralize(list.length, 'automation')} · ${formatNumber(active)} active` : 'Comment and DM keyword triggers'}
        actions={
          <ButtonLink to="/automations/new" variant="primary" icon={<Plus className="size-4" />}>
            New automation
          </ButtonLink>
        }
      />

      {loading ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : error ? (
        <ErrorNotice error={error} onRetry={() => void reload()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Zap className="size-6" />}
            title="No automations yet"
            description="Automations reply to comments and DMs for you: send a link when someone comments a keyword, collect emails, or gate content behind a follow."
            action={
              <ButtonLink to="/automations/new" variant="primary" icon={<Plus className="size-4" />}>
                Create your first automation
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {list.map((a) => {
              const isComment = a.trigger.type === 'comment'
              const Icon = isComment ? MessageCircle : Send
              return (
                <li
                  key={a.id}
                  className="group flex cursor-pointer flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:px-5"
                  onClick={() => navigate(`/automations/${a.id}`)}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                        a.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/automations/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-semibold text-slate-900 hover:text-indigo-700"
                      >
                        {a.name}
                      </Link>
                      <p className="mt-0.5 text-sm break-words text-slate-600">{triggerSummary(a.trigger)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Workflow className="size-3.5" />
                          {pluralize(a.flow.steps.length, 'step')}
                        </span>
                        <span>Updated {timeAgo(a.updated_at)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pl-12 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right">
                      <p className="text-lg leading-tight font-semibold text-slate-900 tabular-nums">{formatNumber(a.triggered_count)}</p>
                      <p className="text-xs text-slate-400">triggered</p>
                    </div>
                    <Toggle
                      checked={a.is_active}
                      onChange={() => void toggleActive(a)}
                      srLabel={a.is_active ? `Pause ${a.name}` : `Activate ${a.name}`}
                    />
                    <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
                      <ButtonLink to={`/automations/${a.id}`} size="sm" variant="ghost" icon={<Pencil className="size-4" />}>
                        <span className="max-md:sr-only">Edit</span>
                      </ButtonLink>
                      <IconButton
                        label="Duplicate"
                        disabled={busy === `dup:${a.id}`}
                        onClick={() => void duplicate(a)}
                      >
                        <CopyPlus className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        variant="danger-ghost"
                        disabled={busy === `del:${a.id}`}
                        onClick={() => void remove(a)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

    </div>
  )
}
