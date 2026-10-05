import { ArrowRight, FilePlus2, Link2, Mail, MessageSquareReply } from 'lucide-react'
import type { ReactNode } from 'react'
import { TEMPLATES, type AutomationTemplate, type TemplateId } from '../../lib/templates'
import { cn } from '../../lib/utils'

const ICONS: Record<TemplateId, ReactNode> = {
  follow_gate_link: <Link2 className="size-5" />,
  collect_email: <Mail className="size-5" />,
  dm_keyword: <MessageSquareReply className="size-5" />,
  blank: <FilePlus2 className="size-5" />,
}

const ACCENTS: Record<TemplateId, string> = {
  follow_gate_link: 'from-indigo-500 to-violet-500',
  collect_email: 'from-violet-500 to-fuchsia-500',
  dm_keyword: 'from-sky-500 to-indigo-500',
  blank: 'from-slate-400 to-slate-500',
}

/** Quick-start cards for the available templates. */
export function TemplateGrid({ onPick, compact = false }: { onPick: (t: AutomationTemplate) => void; compact?: boolean }) {
  return (
    <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                ACCENTS[t.id],
              )}
            >
              {ICONS[t.id]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{t.description}</span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </div>
          {!compact && (
            <div className="mt-4 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
              {t.preview.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300">→</span>}
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{p}</span>
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
