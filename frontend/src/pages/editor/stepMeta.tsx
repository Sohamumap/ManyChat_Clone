import { Clock, FormInput, Image, MessageSquare, Tag, UserCheck, type LucideIcon } from 'lucide-react'
import type { StepType } from '../../types'

export const STEP_ICONS: Record<StepType, LucideIcon> = {
  message: MessageSquare,
  card: Image,
  delay: Clock,
  follow_check: UserCheck,
  collect_input: FormInput,
  add_tag: Tag,
}

/** Icon tile colors per step type. */
export const STEP_COLORS: Record<StepType, string> = {
  message: 'bg-indigo-50 text-indigo-600 ring-indigo-600/15',
  card: 'bg-sky-50 text-sky-600 ring-sky-600/15',
  delay: 'bg-amber-50 text-amber-600 ring-amber-600/20',
  follow_check: 'bg-emerald-50 text-emerald-600 ring-emerald-600/15',
  collect_input: 'bg-violet-50 text-violet-600 ring-violet-600/15',
  add_tag: 'bg-rose-50 text-rose-600 ring-rose-600/15',
}
