import { Check, ChevronDown, ChevronRight, CircleAlert, Minus, RefreshCw, Webhook } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Badge, CommentStatusBadge, RunStatusBadge, commentStatusLabel, runStatusLabel } from '../components/Badge'
import { IconButton } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { NoAccount } from '../components/Layout'
import { ErrorNotice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { LoadingBlock } from '../components/Spinner'
import { Tabs } from '../components/Tabs'
import { Toggle } from '../components/Toggle'
import { useAccounts } from '../lib/accounts'
import { useAsync, useInterval, useNow, type AsyncState } from '../lib/hooks'
import { formatDateTime, timeAgo } from '../lib/time'
import { cn, prettyJson, truncate } from '../lib/utils'
import { COMMENT_STATUSES, RUN_STATUSES, type WebhookLogEntry } from '../types'

type TabId = 'comments' | 'runs' | 'webhooks' | 'failed'
const TABS: { id: TabId; label: string }[] = [
  { id: 'comments', label: 'Comments' },
  { id: 'runs', label: 'Flow runs' },
  { id: 'webhooks', label: 'Webhook log' },
  { id: 'failed', label: 'Failed jobs' },
]
const LIMIT = 50
const REFRESH_MS = 10_000

export default function ActivityPage() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as TabId | null
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? tabParam! : 'comments'
  const status = params.get('status') ?? ''
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const { accountId, loading: accountsLoading } = useAccounts()

  const setTab = (id: TabId) => setParams(id === 'comments' ? {} : { tab: id }, { replace: true })
  const setStatus = (s: string) => {
    const next = new URLSearchParams(params)
    if (s) next.set('status', s)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  const statusOptions = tab === 'comments' ? COMMENT_STATUSES : tab === 'runs' ? RUN_STATUSES : null
  const needsAccount = tab === 'comments' || tab === 'runs'
  const common = { autoRefresh, refreshTick }

  return (
    <div>
      <PageHeader
        title="Activity"
        description="What FlowDM received and did, newest first."
        actions={
          <div className="flex items-center gap-3">
            <Toggle checked={autoRefresh} onChange={setAutoRefresh} label="Auto-refresh (10s)" size="sm" />
            <IconButton label="Refresh now" variant="secondary" onClick={() => setRefreshTick((t) => t + 1)}>
              <RefreshCw className="size-4" />
            </IconButton>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {statusOptions && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="input h-9 w-auto min-w-[11rem] py-1.5"
          >
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {tab === 'comments' ? commentStatusLabel(s) : runStatusLabel(s)}
              </option>
            ))}
          </select>
        )}
      </div>

      {needsAccount && accountsLoading ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : needsAccount && accountId == null ? (
        <NoAccount />
      ) : (
        <>
          {tab === 'comments' && <CommentsTab key={`${accountId}:${status}`} accountId={accountId!} status={status} {...common} />}
          {tab === 'runs' && <RunsTab key={`${accountId}:${status}`} accountId={accountId!} status={status} {...common} />}
          {tab === 'webhooks' && <WebhooksTab {...common} />}
          {tab === 'failed' && <FailedJobsTab {...common} />}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ shared

interface RefreshProps {
  autoRefresh: boolean
  refreshTick: number
}

/** Silent reload every 10s while auto-refresh is on, and whenever "Refresh now" is clicked. */
function useRefresh<T>(state: AsyncState<T>, { autoRefresh, refreshTick }: RefreshProps) {
  useInterval(() => void state.reload(true), REFRESH_MS, autoRefresh)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void state.reload(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])
}

function TableShell({
  state,
  empty,
  children,
  footer,
}: {
  state: { loading: boolean; error: string | null; reload: () => Promise<void>; hasData: boolean; isEmpty: boolean }
  empty: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      {state.loading && !state.hasData ? (
        <LoadingBlock />
      ) : state.error && !state.hasData ? (
        <div className="p-4">
          <ErrorNotice error={state.error} onRetry={() => void state.reload()} />
        </div>
      ) : state.isEmpty ? (
        empty
      ) : (
        <>
          {state.error && (
            <p className="flex items-center gap-1.5 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              <CircleAlert className="size-3.5" />
              Refresh failed: {state.error}
            </p>
          )}
          <div className="relative overflow-x-auto">{children}</div>
          {footer}
        </>
      )}
    </Card>
  )
}

function Yes({ value, title }: { value: boolean; title: string }) {
  return value ? (
    <span title={title} className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
      <Check className="size-3.5" strokeWidth={3} />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center text-slate-300">
      <Minus className="size-4" />
      <span className="sr-only">No</span>
    </span>
  )
}

function When({ iso, now }: { iso: string; now: Date }) {
  return (
    <span className="whitespace-nowrap text-slate-500" title={formatDateTime(iso)}>
      {timeAgo(iso, now)}
    </span>
  )
}

// ------------------------------------------------------------------ comments

function CommentsTab({ accountId, status, ...refresh }: { accountId: number; status: string } & RefreshProps) {
  const [offset, setOffset] = useState(0)
  const now = useNow(15_000)
  const state = useAsync(
    () => api.activity.comments({ account_id: accountId, status: status || undefined, limit: LIMIT, offset }),
    [accountId, status, offset],
    { keepPrevious: true },
  )
  useRefresh(state, refresh)
  const items = state.data?.items ?? []

  return (
    <TableShell
      state={{ ...state, hasData: !!state.data, isEmpty: items.length === 0 }}
      empty={
        <EmptyState
          title={status ? 'No comments with this status' : 'No comments yet'}
          description="Comments on your posts and reels show up here as Instagram delivers them."
        />
      }
      footer={<Pagination total={state.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />}
    >
      <table className="table-base">
        <thead>
          <tr>
            <th>Time</th>
            <th>From</th>
            <th>Comment</th>
            <th>Automation</th>
            <th>Status</th>
            <th className="w-16 text-center !whitespace-normal">DM sent</th>
            <th className="w-16 text-center !whitespace-normal">Public reply</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <When iso={c.created_at} now={now} />
              </td>
              <td className="whitespace-nowrap">
                {c.contact_id ? (
                  <Link to={`/contacts/${c.contact_id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                    @{c.from_username ?? 'unknown'}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-900">@{c.from_username ?? 'unknown'}</span>
                )}
              </td>
              <td className="min-w-[10rem]">
                <span title={c.text ?? undefined} className="line-clamp-2 max-w-[16rem]">
                  {c.text ? truncate(c.text, 140) : <span className="text-slate-400 italic">(no text)</span>}
                </span>
              </td>
              <td className="min-w-[8rem]">
                {c.automation_id ? (
                  <Link to={`/automations/${c.automation_id}`} className="line-clamp-2 max-w-[12rem] text-slate-700 hover:text-indigo-700">
                    {c.automation_name ?? `#${c.automation_id}`}
                  </Link>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td>
                <CommentStatusBadge status={c.status} />
              </td>
              <td className="text-center">
                <Yes value={c.dm_sent} title="DM sent" />
              </td>
              <td className="text-center">
                <Yes value={!!c.public_reply_id} title="Public reply posted" />
              </td>
              <td className="min-w-[10rem]">
                {c.error ? <span className="text-xs break-words text-red-600">{c.error}</span> : <span className="text-slate-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

// ------------------------------------------------------------------ runs

function RunsTab({ accountId, status, ...refresh }: { accountId: number; status: string } & RefreshProps) {
  const [offset, setOffset] = useState(0)
  const now = useNow(15_000)
  const state = useAsync(
    () => api.activity.runs({ account_id: accountId, status: status || undefined, limit: LIMIT, offset }),
    [accountId, status, offset],
    { keepPrevious: true },
  )
  useRefresh(state, refresh)
  const items = state.data?.items ?? []

  return (
    <TableShell
      state={{ ...state, hasData: !!state.data, isEmpty: items.length === 0 }}
      empty={
        <EmptyState
          title={status ? 'No runs with this status' : 'No flow runs yet'}
          description="Each time an automation starts for someone, a run appears here."
        />
      }
      footer={<Pagination total={state.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />}
    >
      <table className="table-base">
        <thead>
          <tr>
            <th>Started</th>
            <th>Contact</th>
            <th>Automation</th>
            <th>Status</th>
            <th className="text-right">Steps</th>
            <th>Current step</th>
            <th>Error</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((r) => (
            <tr key={r.id}>
              <td>
                <When iso={r.created_at} now={now} />
              </td>
              <td className="whitespace-nowrap">
                <Link to={`/contacts/${r.contact_id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                  {r.contact_username ? `@${r.contact_username}` : `Contact #${r.contact_id}`}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                <Link to={`/automations/${r.automation_id}`} className="text-slate-700 hover:text-indigo-700">
                  {r.automation_name ?? `#${r.automation_id}`}
                </Link>
              </td>
              <td>
                <RunStatusBadge status={r.status} />
              </td>
              <td className="text-right tabular-nums">{r.steps_executed}</td>
              <td className="font-mono text-xs whitespace-nowrap text-slate-500">{r.current_step_id ?? '—'}</td>
              <td className="min-w-[12rem]">
                {r.error ? <span className="text-xs break-words text-red-600">{r.error}</span> : <span className="text-slate-300">—</span>}
              </td>
              <td>
                <When iso={r.updated_at} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

// ------------------------------------------------------------------ webhooks

function summarizeWebhook(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'payload'
  const p = payload as Record<string, unknown>
  const parts: string[] = []
  if (typeof p.object === 'string') parts.push(p.object)
  const entries = Array.isArray(p.entry) ? p.entry : []
  const kinds = new Set<string>()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const entry = e as Record<string, unknown>
    if (Array.isArray(entry.changes)) {
      for (const ch of entry.changes) {
        if (ch && typeof ch === 'object' && typeof (ch as Record<string, unknown>).field === 'string') {
          kinds.add(String((ch as Record<string, unknown>).field))
        }
      }
    }
    if (Array.isArray(entry.messaging)) {
      for (const m of entry.messaging) {
        if (!m || typeof m !== 'object') continue
        const msg = m as Record<string, unknown>
        if (msg.postback) kinds.add('postback')
        else if (msg.read) kinds.add('read')
        else if (msg.reaction) kinds.add('reaction')
        else if (msg.message) {
          const inner = msg.message as Record<string, unknown>
          kinds.add(inner && inner.is_echo ? 'message echo' : 'message')
        } else kinds.add('messaging')
      }
    }
  }
  if (kinds.size) parts.push([...kinds].join(', '))
  if (entries.length > 1) parts.push(`${entries.length} entries`)
  return parts.join(' · ') || 'payload'
}

function WebhookRow({ w, now }: { w: WebhookLogEntry; now: Date }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
      >
        {open ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{summarizeWebhook(w.payload)}</span>
            {w.error ? (
              <Badge tone="red" dot>
                Error
              </Badge>
            ) : w.processed_at ? (
              <Badge tone="green" dot>
                Processed
              </Badge>
            ) : (
              <Badge tone="amber" dot>
                Pending
              </Badge>
            )}
          </span>
          {w.error && <span className="mt-1 block text-xs break-words text-red-600">{w.error}</span>}
        </span>
        <span className="shrink-0 text-xs text-slate-400" title={formatDateTime(w.received_at)}>
          {timeAgo(w.received_at, now)}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 sm:px-5">
          <p className="mb-1.5 text-xs text-slate-500">
            Received {formatDateTime(w.received_at)}
            {w.processed_at && ` · processed ${formatDateTime(w.processed_at)}`}
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
            {prettyJson(w.payload)}
          </pre>
        </div>
      )}
    </li>
  )
}

function WebhooksTab(refresh: RefreshProps) {
  const now = useNow(15_000)
  const state = useAsync(() => api.activity.webhooks(LIMIT), [])
  useRefresh(state, refresh)
  const items = state.data ?? []
  return (
    <TableShell
      state={{ ...state, hasData: !!state.data, isEmpty: items.length === 0 }}
      empty={
        <EmptyState
          icon={<Webhook className="size-6" />}
          title="No webhooks received yet"
          description="Check the webhook URL in Settings and make sure the account's webhooks are subscribed."
        />
      }
      footer={<p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">Showing the latest {LIMIT} deliveries.</p>}
    >
      <ul className="divide-y divide-slate-100">
        {items.map((w) => (
          <WebhookRow key={w.id} w={w} now={now} />
        ))}
      </ul>
    </TableShell>
  )
}

// ------------------------------------------------------------------ failed jobs

function FailedJobsTab(refresh: RefreshProps) {
  const now = useNow(15_000)
  const state = useAsync(() => api.activity.failedJobs(LIMIT), [])
  useRefresh(state, refresh)
  const items = state.data ?? []
  return (
    <TableShell
      state={{ ...state, hasData: !!state.data, isEmpty: items.length === 0 }}
      empty={<EmptyState icon={<Check className="size-6" />} title="No failed jobs" description="Background jobs that gave up after retrying show up here." />}
    >
      <table className="table-base">
        <thead>
          <tr>
            <th>Updated</th>
            <th>Type</th>
            <th className="text-right">Attempts</th>
            <th>Last error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((j) => (
            <tr key={j.id}>
              <td>
                <When iso={j.updated_at} now={now} />
              </td>
              <td className="font-mono text-xs whitespace-nowrap">{j.type}</td>
              <td className="text-right tabular-nums">{j.attempts}</td>
              <td className={cn('min-w-[16rem] text-xs break-words', j.last_error ? 'text-red-600' : 'text-slate-300')}>
                {j.last_error ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}
