import { CircleAlert, ExternalLink, MousePointerClick, Paperclip, Reply, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDateTime, timeAgo } from '../lib/time'
import { cn } from '../lib/utils'
import type { Message } from '../types'

// ------------------------------------------------------------------ payload parsing (defensive: payload is free-form JSON)

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

interface ParsedButton {
  title: string
  url: string | null
}

interface Parsed {
  text: string | null
  card: { title: string | null; subtitle: string | null; image: string | null } | null
  buttons: ParsedButton[]
  quickReplies: string[]
  attachments: { type: string; url: string | null }[]
}

function parseButtons(v: unknown): ParsedButton[] {
  return arr(v)
    .filter(isObj)
    .map((b) => ({ title: str(b.title) ?? '(button)', url: str(b.url) }))
}

const QUICK_REPLY_LABELS: Record<string, string> = {
  user_email: 'Suggests their email',
  user_phone_number: 'Suggests their phone number',
}

function parsePayload(m: Message): Parsed {
  const out: Parsed = { text: m.text, card: null, buttons: [], quickReplies: [], attachments: [] }
  const p = m.payload
  if (!isObj(p)) return out

  if (str(p.text)) out.text = str(p.text)
  out.quickReplies = arr(p.quick_replies)
    .filter(isObj)
    .map((q) => str(q.title) ?? QUICK_REPLY_LABELS[str(q.content_type) ?? ''] ?? str(q.content_type) ?? 'Quick reply')

  const attachment = isObj(p.attachment) ? p.attachment : null
  if (attachment && isObj(attachment.payload)) {
    const tp = attachment.payload
    if (tp.template_type === 'button') {
      out.text = str(tp.text) ?? out.text
      out.buttons = parseButtons(tp.buttons)
    } else if (tp.template_type === 'generic') {
      const el = arr(tp.elements).find(isObj)
      if (el) {
        out.card = { title: str(el.title), subtitle: str(el.subtitle), image: str(el.image_url) }
        out.buttons = parseButtons(el.buttons)
        if (out.text === out.card.title) out.text = null
      }
    } else if (attachment.type && attachment.type !== 'template') {
      out.attachments.push({ type: String(attachment.type), url: str(tp.url) })
    }
  }

  for (const a of arr(p.attachments).filter(isObj)) {
    const payload = isObj(a.payload) ? a.payload : {}
    out.attachments.push({ type: str(a.type) ?? 'file', url: str(payload.url) })
  }
  return out
}

// ------------------------------------------------------------------ bubble

const KIND_LABELS: Record<string, string> = {
  private_reply: 'Private reply to comment',
  quick_reply: 'Quick reply',
}

export function MessageBubble({ message, now }: { message: Message; now?: Date }) {
  const out = message.direction === 'out'
  const time = (
    <span title={formatDateTime(message.created_at)} className="text-[11px] text-slate-400">
      {timeAgo(message.created_at, now)}
    </span>
  )

  // Button taps are shown as a compact event line
  if (message.kind === 'postback') {
    return (
      <div className={cn('flex flex-col gap-1', out ? 'items-end' : 'items-start')}>
        <div className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
          <MousePointerClick className="size-3.5 shrink-0" />
          <span className="truncate">tapped: {message.text || 'a button'}</span>
        </div>
        {time}
      </div>
    )
  }

  const parsed = parsePayload(message)
  const bubble = out
    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md'
    : 'bg-slate-100 text-slate-800 rounded-bl-md'
  const kindLabel = KIND_LABELS[message.kind]
  const failed = !!message.error

  let body: ReactNode
  if (parsed.card) {
    body = (
      <div className={cn('overflow-hidden rounded-2xl ring-1', out ? 'rounded-br-md ring-indigo-200' : 'rounded-bl-md ring-slate-200', 'bg-white text-slate-800')}>
        {parsed.card.image && (
          <img src={parsed.card.image} alt="" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full bg-slate-100 object-cover" />
        )}
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{parsed.card.title}</p>
          {parsed.card.subtitle && <p className="text-xs text-slate-500">{parsed.card.subtitle}</p>}
        </div>
        <ButtonList buttons={parsed.buttons} light />
      </div>
    )
  } else {
    body = (
      <div className={cn('overflow-hidden rounded-2xl', bubble, failed && out && 'opacity-70')}>
        {parsed.text ? (
          <p className="px-3.5 py-2 text-sm break-words whitespace-pre-wrap">{parsed.text}</p>
        ) : parsed.attachments.length === 0 ? (
          <p className="px-3.5 py-2 text-sm italic opacity-70">({message.kind || 'message'})</p>
        ) : null}
        {parsed.attachments.map((a, i) => (
          <p key={i} className="flex items-center gap-1.5 px-3.5 py-2 text-sm">
            <Paperclip className="size-3.5 shrink-0" />
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {a.type}
              </a>
            ) : (
              a.type
            )}
          </p>
        ))}
        {parsed.buttons.length > 0 && <ButtonList buttons={parsed.buttons} light={!out} />}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', out ? 'items-end' : 'items-start')}>
      {kindLabel && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
          {message.kind === 'private_reply' ? <Reply className="size-3" /> : null}
          {kindLabel}
        </span>
      )}
      <div className="max-w-[85%] sm:max-w-[70%]">{body}</div>
      {parsed.quickReplies.length > 0 && (
        <div className={cn('flex max-w-[85%] flex-wrap gap-1', out ? 'justify-end' : 'justify-start')}>
          {parsed.quickReplies.map((q, i) => (
            <span key={i} className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-xs text-indigo-700">
              {q}
            </span>
          ))}
        </div>
      )}
      {failed && (
        <p className="flex max-w-[85%] items-start gap-1 text-xs text-red-600">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span className="break-words">Not delivered: {message.error}</span>
        </p>
      )}
      <span className="flex items-center gap-1.5">
        {message.automation_id != null && out && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400" title={`Automation #${message.automation_id}`}>
            <Workflow className="size-3" />
          </span>
        )}
        {time}
      </span>
    </div>
  )
}

function ButtonList({ buttons, light }: { buttons: ParsedButton[]; light?: boolean }) {
  if (!buttons.length) return null
  return (
    <div className={cn('divide-y border-t', light ? 'divide-slate-200 border-slate-200' : 'divide-white/20 border-white/20')}>
      {buttons.map((b, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-1.5 text-center text-sm font-medium',
            light ? 'text-indigo-600' : 'text-white',
          )}
        >
          {b.title}
          {b.url && <ExternalLink className="size-3 opacity-70" />}
        </div>
      ))}
    </div>
  )
}
