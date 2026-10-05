import { Check, Download, Minus, Search, Tag, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Avatar } from '../components/Avatar'
import { buttonClass } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { RequireAccount } from '../components/Layout'
import { ErrorNotice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { LoadingBlock, Spinner } from '../components/Spinner'
import { useAsync, useDebounced, useNow } from '../lib/hooks'
import { formatDateTime, timeAgo } from '../lib/time'
import { cn, pluralize } from '../lib/utils'
import type { Contact } from '../types'

const LIMIT = 50

export default function ContactsPage() {
  return <RequireAccount>{(accountId) => <ContactList accountId={accountId} />}</RequireAccount>
}

export function FollowerMark({ value }: { value: boolean | null }) {
  if (value === true)
    return (
      <span title="Follows you" className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="size-3.5" strokeWidth={3} />
        <span className="sr-only">Follows you</span>
      </span>
    )
  if (value === false)
    return (
      <span title="Doesn't follow you" className="inline-flex size-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <X className="size-3.5" strokeWidth={3} />
        <span className="sr-only">Doesn't follow you</span>
      </span>
    )
  return (
    <span title="Unknown (not checked yet)" className="inline-flex size-6 items-center justify-center rounded-full bg-slate-50 text-xs font-semibold text-slate-400">
      ?<span className="sr-only">Unknown</span>
    </span>
  )
}

export function lastActive(c: Contact): string | null {
  return c.last_interaction_at ?? c.last_inbound_at ?? null
}

function ContactList({ accountId }: { accountId: number }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const now = useNow()
  const q = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const [search, setSearch] = useState(q)
  const debounced = useDebounced(search.trim(), 300)

  const update = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 0) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace: true })
  }

  // push the debounced search into the URL (and back to page 1)
  useEffect(() => {
    if (debounced !== q) update({ q: debounced, offset: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, error, loading, reload } = useAsync(
    () => api.contacts.list({ account_id: accountId, q: q || undefined, tag: tag || undefined, limit: LIMIT, offset }),
    [accountId, q, tag, offset],
    { keepPrevious: true },
  )

  const filtered = !!(q || tag)

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={data ? pluralize(data.total, filtered ? 'match' : 'contact', filtered ? 'matches' : 'contacts') : 'People who interacted with your account'}
        actions={
          <a href={api.contacts.exportUrl(accountId)} download className={buttonClass('secondary', 'md')}>
            <Download className="size-4" />
            Export CSV
          </a>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 sm:px-4">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username, name, email, phone…"
              aria-label="Search contacts"
              className="input pl-9"
            />
            {loading && search.trim() !== '' && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
                <Spinner className="size-3.5" />
              </span>
            )}
          </div>
          {tag && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 py-1 pr-1 pl-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-600/15">
              <Tag className="size-3.5" />
              {tag}
              <button
                type="button"
                aria-label="Clear tag filter"
                onClick={() => update({ tag: null, offset: null })}
                className="rounded p-0.5 hover:bg-indigo-100"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={() => void reload()} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={filtered ? 'No contacts match' : 'No contacts yet'}
            description={
              filtered
                ? 'Try a different search or clear the tag filter.'
                : 'Contacts appear here once people comment on your posts or message your account.'
            }
          />
        ) : (
          <>
            <div className={cn('relative overflow-x-auto transition-opacity', loading && 'opacity-60')}>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th className="text-center">Follower</th>
                    <th>Tags</th>
                    <th>Last active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/contacts/${c.id}`)}
                      tabIndex={0}
                      className="cursor-pointer transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar src={c.profile_pic} name={c.name} username={c.username} size={34} />
                          <div className="min-w-0">
                            <p className="font-medium whitespace-nowrap text-slate-900">
                              {c.username ? `@${c.username}` : <span className="text-slate-400">Unknown user</span>}
                            </p>
                            {c.name && <p className="max-w-[14rem] truncate text-xs text-slate-500">{c.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{c.email ?? <Minus className="size-4 text-slate-300" />}</td>
                      <td className="whitespace-nowrap">{c.phone ?? <Minus className="size-4 text-slate-300" />}</td>
                      <td className="text-center">
                        <FollowerMark value={c.is_follower} />
                      </td>
                      <td>
                        <div className="flex max-w-[16rem] flex-wrap gap-1">
                          {c.tags.length === 0 && <Minus className="size-4 text-slate-300" />}
                          {c.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              title={`Show contacts tagged “${t}”`}
                              onClick={(e) => {
                                e.stopPropagation()
                                update({ tag: t, offset: null })
                              }}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-slate-500" title={formatDateTime(lastActive(c))}>
                        {timeAgo(lastActive(c), now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={(o) => update({ offset: o })} />
          </>
        )}
      </Card>
    </div>
  )
}
