import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '../lib/utils'
import type { DailyStat } from '../types'

const SERIES = [
  { key: 'comments', label: 'Comments', color: 'var(--color-series-1)' },
  { key: 'dms_sent', label: 'DMs sent', color: 'var(--color-series-2)' },
] as const

const HEIGHT = 220
const MARGIN = { top: 12, right: 8, bottom: 26, left: 36 }
const BAR_MAX = 24
const BAR_GAP = 2
const RADIUS = 4

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Round the axis maximum up to a clean value and return evenly spaced integer ticks. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) max = count
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = Math.max(1, Math.round((norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag))
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return ticks
}

function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function shortDay(date: string): string {
  return parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function longDay(date: string): string {
  return parseDay(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Rounded data-end, square baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/** Grouped column chart: comments vs DMs sent per day (plain SVG, no chart library). */
export function DailyChart({ data }: { data: DailyStat[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(0, ...data.flatMap((d) => [d.comments, d.dms_sent]))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const band = data.length ? plotW / data.length : 0
  const barW = Math.max(2, Math.min(BAR_MAX, (band * 0.7 - BAR_GAP) / 2))
  const groupW = barW * 2 + BAR_GAP
  const y = (v: number) => MARGIN.top + plotH - (v / top) * plotH
  const labelEvery = band < 26 ? 3 : band < 44 ? 2 : 1
  const hovered = hover != null ? data[hover] : null

  return (
    <div>
      {/* legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Comments and DMs sent per day, last 14 days" className="block">
            {/* grid + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--color-slate-200)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                  {formatNumber(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x0 = MARGIN.left + i * band
              const gx = x0 + (band - groupW) / 2
              return (
                <g key={d.date}>
                  {hover === i && <rect x={x0 + 1} y={MARGIN.top} width={band - 2} height={plotH} rx={6} fill="var(--color-slate-100)" />}
                  {SERIES.map((s, j) => {
                    const v = d[s.key]
                    const h = (v / top) * plotH
                    return <path key={s.key} d={columnPath(gx + j * (barW + BAR_GAP), y(v), barW, h)} fill={s.color} />
                  })}
                  {(data.length - 1 - i) % labelEvery === 0 && (
                    <text x={x0 + band / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                      {shortDay(d.date)}
                    </text>
                  )}
                  {/* hit target: the whole day column */}
                  <rect
                    x={x0}
                    y={MARGIN.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onTouchStart={() => setHover(i)}
                  />
                </g>
              )
            })}

            {/* baseline */}
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} stroke="var(--color-slate-300)" strokeWidth={1} shapeRendering="crispEdges" />
          </svg>
        )}

        {hovered && hover != null && (
          <div
            className="pointer-events-none absolute z-10 w-40 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-900/10"
            style={{
              top: 4,
              left: Math.min(Math.max(0, MARGIN.left + hover * band + band / 2 - 80), Math.max(0, width - 160)),
            }}
          >
            <p className="mb-1 font-semibold text-slate-800">{longDay(hovered.date)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatNumber(hovered[s.key])}</span>
              </p>
            ))}
            <p className="mt-1 flex justify-between gap-3 border-t border-slate-100 pt-1 text-slate-500">
              New contacts <span className="font-medium text-slate-700 tabular-nums">{formatNumber(hovered.new_contacts)}</span>
            </p>
          </div>
        )}
      </div>

      {/* accessible table view (a table can't shrink to 1px itself, so wrap it) */}
      <div className="sr-only">
      <table>
        <caption>Daily activity, last 14 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Comments</th>
            <th>DMs sent</th>
            <th>New contacts</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.comments}</td>
              <td>{d.dms_sent}</td>
              <td>{d.new_contacts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
