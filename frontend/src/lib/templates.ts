import type { Flow, Step } from '../types'
import { createStep, defaultTriggerDraft, newStepId, type EditorDraft } from './flow'

export type TemplateId = 'follow_gate_link' | 'collect_email' | 'dm_keyword' | 'blank'

export interface AutomationTemplate {
  id: TemplateId
  name: string
  description: string
  /** Short labels shown as the template's step preview. */
  preview: string[]
  build: () => EditorDraft
}

/** Allocate `n` fresh unique step ids. */
function ids(n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(newStepId(out))
  return out
}

function flow(steps: Step[]): Flow {
  return { start_step_id: steps[0].id, steps }
}

export const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'follow_gate_link',
    name: 'Comment → DM link with follow-gate',
    description: 'Someone comments LINK, gets a DM, and receives the link once they follow you.',
    preview: ['Message + button', 'Follow check', 'Ask to follow', 'Send link'],
    build: () => {
      const [s1, s2, s3, s4] = ids(4)
      return {
        name: 'Link with follow-gate',
        is_active: true,
        trigger: {
          ...defaultTriggerDraft('comment'),
          keywords: ['LINK'],
          commentMatch: 'contains',
          public_replies: ['Sent you a DM! 📩', 'Check your DMs 😉', 'Just sent it over! 🙌'],
        },
        flow: flow([
          {
            id: s1,
            label: 'Welcome',
            type: 'message',
            text: "Hey {first_name}! 👋 Thanks for your comment. Tap below and I'll send you the link.",
            buttons: [{ title: 'Send me the link', type: 'step', step_id: s2 }],
            next_step_id: null,
          },
          {
            id: s2,
            label: 'Follow gate',
            type: 'follow_check',
            following_step_id: s4,
            not_following_step_id: s3,
          },
          {
            id: s3,
            label: 'Ask to follow',
            type: 'message',
            text: 'Almost there! Please follow my account first, then tap the button below 🙏',
            buttons: [{ title: 'I followed ✅', type: 'step', step_id: s2 }],
            next_step_id: null,
          },
          {
            id: s4,
            label: 'Send link',
            type: 'message',
            text: 'Here you go! 🎉',
            buttons: [{ title: 'Open link', type: 'url', url: 'https://example.com' }],
            next_step_id: null,
          },
        ]),
      }
    },
  },
  {
    id: 'collect_email',
    name: 'Comment → collect email',
    description: 'Offer a freebie in the DM and save the email address they reply with.',
    preview: ['Message + button', 'Collect email', 'Thank you'],
    build: () => {
      const [s1, s2, s3] = ids(3)
      return {
        name: 'Collect emails from comments',
        is_active: true,
        trigger: {
          ...defaultTriggerDraft('comment'),
          keywords: ['GUIDE'],
          commentMatch: 'contains',
          public_replies: ['Check your DMs 📩', 'Sent you a DM! 😉'],
        },
        flow: flow([
          {
            id: s1,
            label: 'Offer',
            type: 'message',
            text: 'Hey {first_name}! 👋 Want me to send you the free guide by email?',
            buttons: [{ title: 'Yes please!', type: 'step', step_id: s2 }],
            next_step_id: null,
          },
          {
            id: s2,
            label: 'Ask for email',
            type: 'collect_input',
            text: "What's the best email to send it to?",
            input_type: 'email',
            field_name: null,
            retry_text: "Hmm, that doesn't look like an email address. Please try again 🙂",
            max_attempts: 3,
            next_step_id: s3,
          },
          {
            id: s3,
            label: 'Thank you',
            type: 'message',
            text: 'Thanks! Check your inbox 📬',
            buttons: [],
            next_step_id: null,
          },
        ]),
      }
    },
  },
  {
    id: 'dm_keyword',
    name: 'DM keyword auto-reply',
    description: 'Reply instantly when someone sends you a keyword like PRICE in a DM.',
    preview: ['Message'],
    build: () => {
      const [s1] = ids(1)
      return {
        name: 'PRICE auto-reply',
        is_active: true,
        trigger: { ...defaultTriggerDraft('dm_keyword'), keywords: ['PRICE'], dmMatch: 'exact' },
        flow: flow([
          {
            id: s1,
            label: 'Reply',
            type: 'message',
            text: "Hi {first_name}! 👋 Thanks for asking. Our plans start at $29/month. Reply here if you have any questions and I'll get back to you!",
            buttons: [],
            next_step_id: null,
          },
        ]),
      }
    },
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch with a single empty message.',
    preview: ['Message'],
    build: () => {
      const [s1] = ids(1)
      return {
        name: '',
        is_active: true,
        trigger: defaultTriggerDraft('comment'),
        flow: flow([createStep('message', s1)]),
      }
    },
  },
]
