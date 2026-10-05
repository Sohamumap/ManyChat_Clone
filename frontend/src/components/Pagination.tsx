import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../lib/utils'
import { Button } from './Button'

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}) {
  if (total <= 0) return null
  const from = Math.min(total, offset + 1)
  const to = Math.min(total, offset + limit)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-5">
      <span>
        <span className="font-medium text-slate-700">{formatNumber(from)}</span>–
        <span className="font-medium text-slate-700">{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-slate-700">{formatNumber(total)}</span>
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          icon={<ChevronLeft className="size-4" />}
          disabled={offset <= 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
