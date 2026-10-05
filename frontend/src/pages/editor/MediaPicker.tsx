import { Check, Clapperboard, Images, ImageOff, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../../api'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { LoadingBlock } from '../../components/Spinner'
import { formatDate } from '../../lib/time'
import { cn, truncate } from '../../lib/utils'
import type { Media } from '../../types'

function previewUrl(m: Media): string | null {
  const isVideo = m.media_type === 'VIDEO' || m.media_product_type === 'REELS'
  return (isVideo ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? m.media_url ?? null
}

function MediaThumb({ media }: { media: Media }) {
  const [broken, setBroken] = useState(false)
  const src = previewUrl(media)
  if (!src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
        <ImageOff className="size-6" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  )
}

interface Props {
  accountId: number
  selected: string[]
  onChange: (ids: string[]) => void
  invalid?: boolean
}

/** Grid of the account's posts & reels, paginated with "Load more". */
export function MediaPicker({ accountId, selected, onChange, invalid }: Props) {
  const [items, setItems] = useState<Media[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(
    async (after: string | null) => {
      const id = ++seq.current
      if (after) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const page = await api.accounts.media(accountId, after)
        if (id !== seq.current) return
        setItems((prev) => {
          if (!after) return page.items
          const seen = new Set(prev.map((m) => m.id))
          return [...prev, ...page.items.filter((m) => !seen.has(m.id))]
        })
        setNext(page.next)
      } catch (err) {
        if (id === seq.current) setError(errorMessage(err))
      } finally {
        if (id === seq.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [accountId],
  )

  useEffect(() => {
    setItems([])
    setNext(null)
    void load(null)
  }, [load])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  const loadedIds = new Set(items.map((m) => m.id))
  const hiddenSelected = selected.filter((id) => !loadedIds.has(id)).length

  return (
    <div className={cn('rounded-xl border bg-slate-50/50 p-3', invalid ? 'border-red-300' : 'border-slate-200')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{selected.length}</span> selected
          {hiddenSelected > 0 && !loading && (
            <span className="text-slate-400"> · {hiddenSelected} not shown below{next ? ' (load more to see them)' : ''}</span>
          )}
        </p>
        <div className="flex gap-1">
          {selected.length > 0 && (
            <Button size="xs" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
          <Button size="xs" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={() => void load(null)} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Notice tone="error" className="mb-3" action={<Button size="xs" onClick={() => void load(items.length ? next : null)}>Retry</Button>}>
          Couldn't load posts: {error}
        </Notice>
      )}

      {loading ? (
        <LoadingBlock label="Loading posts…" className="py-10" />
      ) : items.length === 0 && !error ? (
        <div className="flex flex-col items-center py-10 text-center text-sm text-slate-500">
          <Images className="mb-2 size-6 text-slate-300" />
          No posts or reels found on this account.
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => {
            const isSelected = selected.includes(m.id)
            const isReel = m.media_type === 'VIDEO' || m.media_product_type === 'REELS'
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={isSelected}
                  title={m.caption ?? undefined}
                  className={cn(
                    'group block w-full overflow-hidden rounded-lg bg-white text-left ring-1 transition',
                    isSelected ? 'ring-2 ring-indigo-500' : 'ring-slate-200 hover:ring-slate-300',
                  )}
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <MediaThumb media={m} />
                    {isReel && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/50 p-0.5 text-white">
                        <Clapperboard className="size-3.5" />
                      </span>
                    )}
                    <span
                      className={cn(
                        'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-2 transition',
                        isSelected
                          ? 'border-white bg-indigo-600 text-white shadow'
                          : 'border-white/90 bg-black/20 text-transparent group-hover:bg-black/30',
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    {isSelected && <span className="absolute inset-0 bg-indigo-600/10" aria-hidden />}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-4 text-slate-600">
                      {m.caption ? truncate(m.caption, 70) : <span className="text-slate-400 italic">No caption</span>}
                    </p>
                    {m.timestamp && <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(m.timestamp)}</p>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {next && !loading && (
        <div className="mt-3 flex justify-center">
          <Button size="sm" loading={loadingMore} onClick={() => void load(next)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
