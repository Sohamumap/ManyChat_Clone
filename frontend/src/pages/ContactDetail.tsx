import { ArrowLeft, ExternalLink, MessagesSquare, RefreshCw, Trash2, Workflow } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { Avatar } from '../components/Avatar'
import { RunStatusBadge } from '../components/Badge'
import { Button, IconButton } from '../components/Button'
import { Card, CardBody, CardHeader } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { MessageBubble } from '../components/MessageBubble'
import { useConfirm } from '../components/Modal'
import { ErrorNotice } from '../components/Notice'
import { LoadingBlock } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { useAsync, useNow } from '../lib/hooks'
import { formatDateTime, parseDate, timeAgo } from '../lib/time'
import { prettyJson } from '../lib/utils'
import type { Contact, Message, Run } from '../types'
import { FollowerMark } from './Contacts'

export default function ContactDetailPage() {
  const { id } = useParams()
  const contactId = Number(id)
  if (!Number.isInteger(contactId) || contactId <= 0) return <ErrorNotice error="This contact doesn't exist." />
  return <ContactDetail key={contactId} id={contactId} />
}

function BackLink() {
  return (
    <Link to="/contacts" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
      <ArrowLeft className="size-4" />
      Contacts
    </Link>
  )
}

function ContactDetail({ id }: { id: number }) {
  const contact = useAsync(() => api.contacts.get(id), [id])
  const messages = useAsync(() => api.contacts.messages(id), [id])
  const runs = useAsync(() => api.contacts.runs(id), [id])
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)

  const remove = async (c: Contact) => {
    const ok = await confirm({
      title: `Delete ${c.username ? `@${c.username}` : 'this contact'}?`,
      message: 'Their profile, collected data, conversation history and flow runs are removed. This can’t be undone.',
      confirmLabel: 'Delete contact',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await api.contacts.remove(c.id)
      toast.success('Contact deleted')
      navigate('/contacts', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
      setDeleting(false)
    }
  }

  if (contact.loading) return <LoadingBlock label="Loading contact…" />
  if (contact.error || !contact.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNotice error={contact.error ?? 'Not found'} onRetry={() => void contact.reload()} />
      </div>
    )
  }
  const c = contact.data

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <ProfileCard contact={c} onDelete={() => void remove(c)} deleting={deleting} />
        </div>
        <div className="min-w-0 space-y-6">
          <Conversation
            messages={messages.data}
            loading={messages.loading}
            error={messages.error}
            onReload={() => void messages.reload(true)}
          />
          <RunsCard runs={runs.data} loading={runs.loading} error={runs.error} onRetry={() => void runs.reload()} />
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ profile

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right break-words text-slate-800">{children}</dd>
    </div>
  )
}

const dash = <span className="text-slate-300">—</span>

function formatCustomValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return prettyJson(v)
}

function ProfileCard({ contact: c, onDelete, deleting }: { contact: Contact; onDelete: () => void; deleting: boolean }) {
  const custom = Object.entries(c.custom_fields ?? {})
  return (
    <Card>
      <CardBody className="flex flex-col items-center pt-6 text-center">
        <Avatar src={c.profile_pic} name={c.name} username={c.username} size={72} />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">{c.username ? `@${c.username}` : 'Unknown user'}</h1>
        {c.name && <p className="text-sm text-slate-500">{c.name}</p>}
        {c.username && (
          <a
            href={`https://instagram.com/${encodeURIComponent(c.username)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View on Instagram <ExternalLink className="size-3" />
          </a>
        )}
      </CardBody>
      <dl className="divide-y divide-slate-100 border-t border-slate-100 px-4 sm:px-5">
        <Row label="Email">{c.email ?? dash}</Row>
        <Row label="Phone">{c.phone ?? dash}</Row>
        <Row label="Follows you">
          <span className="inline-flex items-center gap-2">
            {c.is_follower === null ? 'Unknown' : c.is_follower ? 'Yes' : 'No'}
            <FollowerMark value={c.is_follower} />
          </span>
        </Row>
        <Row label="Last message from them">
          <span title={formatDateTime(c.last_inbound_at)}>{c.last_inbound_at ? timeAgo(c.last_inbound_at) : dash}</span>
        </Row>
        <Row label="Last interaction">
          <span title={formatDateTime(c.last_interaction_at)}>{c.last_interaction_at ? timeAgo(c.last_interaction_at) : dash}</span>
        </Row>
        <Row label="First seen">{formatDateTime(c.created_at)}</Row>
        <Row label="Instagram ID">
          <span className="font-mono text-xs text-slate-500">{c.igsid}</span>
        </Row>
      </dl>
      <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Tags</p>
        {c.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {c.tags.map((t) => (
              <Link
                key={t}
                to={`/contacts?tag=${encodeURIComponent(t)}`}
                className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/15 hover:bg-indigo-100"
              >
                {t}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No tags</p>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
        <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Custom fields</p>
        {custom.length ? (
          <dl className="divide-y divide-slate-100">
            {custom.map(([k, v]) => (
              <Row key={k} label={k}>
                <span className="whitespace-pre-wrap">{formatCustomValue(v)}</span>
              </Row>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">None collected yet</p>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
        <Button variant="danger-ghost" size="sm" className="-ml-2" icon={<Trash2 className="size-4" />} onClick={onDelete} loading={deleting}>
          Delete contact
        </Button>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ conversation

function dayKey(iso: string): string {
  const d = parseDate(iso)
  return d ? d.toDateString() : ''
}

function dayLabel(iso: string): string {
  const d = parseDate(iso)
  if (!d) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function Conversation({
  messages,
  loading,
  error,
  onReload,
}: {
  messages?: Message[]
  loading: boolean
  error: string | null
  onReload: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const now = useNow()

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<MessagesSquare className="size-4" />}
        title="Conversation"
        description={messages ? `${messages.length} message${messages.length === 1 ? '' : 's'}${messages.length >= 200 ? ' (latest 200)' : ''}` : undefined}
        actions={
          <IconButton label="Refresh conversation" onClick={onReload} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </IconButton>
        }
      />
      {loading && !messages ? (
        <LoadingBlock />
      ) : error ? (
        <CardBody>
          <ErrorNotice error={error} onRetry={onReload} />
        </CardBody>
      ) : !messages || messages.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="size-6" />} title="No messages yet" />
      ) : (
        <div ref={scrollRef} className="max-h-[36rem] space-y-3 overflow-y-auto bg-slate-50/40 px-3 py-4 sm:px-5">
          {messages.map((m, i) => {
            const newDay = i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at)
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="flex items-center gap-3 py-1 text-[11px] font-medium text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    {dayLabel(m.created_at)}
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
                <MessageBubble message={m} now={now} />
              </Fragment>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ runs

function RunsCard({ runs, loading, error, onRetry }: { runs?: Run[]; loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Workflow className="size-4" />} title="Flow runs" description="Automations this contact went through" />
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <CardBody>
          <ErrorNotice error={error} onRetry={onRetry} />
        </CardBody>
      ) : !runs || runs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No flow runs yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {runs.map((r) => (
            <li key={r.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link to={`/automations/${r.automation_id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                  {r.automation_name ?? `Automation #${r.automation_id}`}
                </Link>
                <RunStatusBadge status={r.status} />
                <span className="ml-auto text-xs text-slate-400" title={formatDateTime(r.created_at)}>
                  {timeAgo(r.created_at)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {r.steps_executed} step{r.steps_executed === 1 ? '' : 's'} executed
                {r.current_step_id && (
                  <>
                    {' '}
                    · at <span className="font-mono">{r.current_step_id}</span>
                  </>
                )}
                {' '}· updated {timeAgo(r.updated_at)}
              </p>
              {r.error && <p className="mt-1 text-xs break-words text-red-600">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
