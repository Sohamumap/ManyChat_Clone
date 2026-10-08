import {
  ChartColumn,
  Check,
  ChevronRight,
  CircleAlert,
  Mail,
  MessageCircle,
  MessageSquareReply,
  Plus,
  Send,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ButtonLink } from '../components/Button'
import { Card, CardBody, CardHeader } from '../components/Card'
import { DailyChart } from '../components/DailyChart'
import { ErrorNotice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAccounts } from '../lib/accounts'
import { useAsync } from '../lib/hooks'
import { cn, formatNumber } from '../lib/utils'
import type { AppConfig, Stats } from '../types'

export default function DashboardPage() {
  const { account, accountId, accounts, loading: accountsLoading } = useAccounts()
  const config = useAsync(() => api.config(), [])
  const stats = useAsync(() => api.stats(accountId!), [accountId], { enabled: accountId != null })

  const checklist = (
    <SetupChecklist
      config={config.data}
      configError={config.error}
      configLoading={config.loading}
      accountsCount={accounts.length}
      accountsLoading={accountsLoading}
      webhooksSubscribed={!!account?.webhooks_subscribed}
      activeAutomations={stats.data?.automations_active}
    />
  )
  const setupDone =
    !!config.data?.instagram_app_configured &&
    accounts.length > 0 &&
    !!account?.webhooks_subscribed &&
    (stats.data?.automations_active ?? 0) > 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={account ? `Overview for @${account.username}` : 'Welcome to FlowDM'}
        actions={
          account && (
            <ButtonLink to="/automations/new" variant="primary" icon={<Plus className="size-4" />}>
              New automation
            </ButtonLink>
          )
        }
      />

      <div className="space-y-6">
        {!setupDone && checklist}

        {accountId != null && (
          <>
            {stats.error ? (
              <ErrorNotice error={stats.error} onRetry={() => void stats.reload()} />
            ) : (
              <StatGrid stats={stats.data} />
            )}

            <Card>
              <CardHeader
                icon={<ChartColumn className="size-4" />}
                title="Last 14 days"
                description="Comments received vs. DMs sent per day"
              />
              <CardBody>
                {stats.loading || !stats.data ? (
                  <div className="h-[244px] animate-pulse rounded-lg bg-slate-100" />
                ) : stats.data.daily.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-500">No activity yet.</p>
                ) : (
                  <DailyChart data={stats.data.daily} />
                )}
              </CardBody>
            </Card>
          </>
        )}

        {setupDone && checklist}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ stat cards

interface StatDef {
  key: keyof Omit<Stats, 'daily'>
  label: string
  icon: LucideIcon
  to?: string
  hint?: (s: Stats) => string | null
  danger?: boolean
}

const STATS_24H: StatDef[] = [
  { key: 'comments_24h', label: 'Comments', icon: MessageCircle, to: '/activity?tab=comments' },
  {
    key: 'comments_matched_24h',
    label: 'Matched',
    icon: Target,
    to: '/activity?tab=comments&status=matched',
    hint: (s) => (s.comments_24h ? `${Math.round((s.comments_matched_24h / s.comments_24h) * 100)}% of comments` : null),
  },
  { key: 'dms_sent_24h', label: 'DMs sent', icon: Send, hint: (s) => `${formatNumber(s.messages_in_24h)} received` },
  { key: 'runs_failed_24h', label: 'Failed runs', icon: CircleAlert, to: '/activity?tab=runs&status=failed', danger: true },
]

const STATS_TOTAL: StatDef[] = [
  { key: 'contacts', label: 'Contacts', icon: Users, to: '/contacts' },
  { key: 'emails_collected', label: 'Emails collected', icon: Mail, to: '/contacts' },
  { key: 'automations_active', label: 'Active automations', icon: Workflow, to: '/automations' },
]

function StatGrid({ stats }: { stats?: Stats }) {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
      <StatGroup title="Last 24 hours" defs={STATS_24H} stats={stats} className="grid-cols-2 sm:grid-cols-4" />
      <StatGroup title="All time" defs={STATS_TOTAL} stats={stats} className="grid-cols-2 sm:grid-cols-3" />
    </div>
  )
}

function StatGroup({ title, defs, stats, className }: { title: string; defs: StatDef[]; stats?: Stats; className: string }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className={cn('grid gap-3', className)}>
        {defs.map((def) => (
          <StatCard key={def.key} def={def} stats={stats} />
        ))}
      </div>
    </section>
  )
}

function StatCard({ def, stats }: { def: StatDef; stats?: Stats }) {
  const value = stats?.[def.key]
  const alert = def.danger && !!value
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-slate-500">{def.label}</span>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            alert ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600',
          )}
        >
          <def.icon className="size-4" />
        </span>
      </div>
      {stats ? (
        <p className={cn('mt-2 text-2xl font-semibold tracking-tight', alert ? 'text-red-600' : 'text-slate-900')}>
          {formatNumber(value)}
        </p>
      ) : (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100" />
      )}
      <p className="mt-0.5 h-4 truncate text-xs text-slate-400">{stats && def.hint ? def.hint(stats) : ''}</p>
    </>
  )
  const cls = cn(
    'block rounded-xl border bg-white p-4 shadow-xs transition',
    alert ? 'border-red-200' : 'border-slate-200',
    def.to && 'hover:border-indigo-200 hover:shadow-sm',
  )
  return def.to ? (
    <Link to={def.to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// ------------------------------------------------------------------ setup checklist

interface ChecklistProps {
  config?: AppConfig
  configError: string | null
  configLoading: boolean
  accountsCount: number
  accountsLoading: boolean
  webhooksSubscribed: boolean
  activeAutomations?: number
}

function SetupChecklist({
  config,
  configError,
  configLoading,
  accountsCount,
  accountsLoading,
  webhooksSubscribed,
  activeAutomations,
}: ChecklistProps) {
  const items: { done: boolean; loading?: boolean; title: string; description: ReactNode; to: string; cta: string }[] = [
    {
      done: !!config?.instagram_app_configured,
      loading: configLoading,
      title: 'Instagram app configured',
      description: configError
        ? `Couldn't check: ${configError}`
        : 'Paste your Meta app’s Instagram app ID and secret in Settings.',
      to: '/accounts',
      cta: 'Add keys',
    },
    {
      done: accountsCount > 0,
      loading: accountsLoading,
      title: 'Instagram account connected',
      description: 'Connect with Instagram login, or paste an access token.',
      to: '/accounts',
      cta: 'Connect',
    },
    {
      done: webhooksSubscribed,
      loading: accountsLoading,
      title: 'Webhooks subscribed',
      description: 'So Instagram tells FlowDM about new comments and messages.',
      to: '/accounts',
      cta: 'Subscribe',
    },
    {
      done: (activeAutomations ?? 0) > 0,
      title: 'At least one active automation',
      description: 'Start from a template: comment → DM with a link takes a minute.',
      to: '/automations/new',
      cta: 'Create',
    },
  ]
  const doneCount = items.filter((i) => i.done).length
  const pct = Math.round((doneCount / items.length) * 100)

  return (
    <Card>
      <CardHeader
        icon={<MessageSquareReply className="size-4" />}
        title="Setup checklist"
        description={doneCount === items.length ? 'All set. FlowDM is ready to reply.' : `${doneCount} of ${items.length} done`}
        actions={
          <div className="flex w-28 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums">{pct}%</span>
          </div>
        }
      />
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const content = (
            <>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white',
                  item.loading && !item.done && 'animate-pulse',
                )}
              >
                {item.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', item.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900')}>
                  {item.title}
                </span>
                {!item.done && <span className="block text-sm text-slate-500">{item.description}</span>}
              </span>
              {!item.done && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-indigo-600">
                  {item.cta}
                  <ChevronRight className="size-4" />
                </span>
              )}
            </>
          )
          return (
            <li key={item.title}>
              {item.done ? (
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5">{content}</div>
              ) : (
                <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5">
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
