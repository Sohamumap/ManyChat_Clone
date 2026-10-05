# HTTP API

All `/api/*` endpoints except `/api/auth/login`, `/api/health` and the OAuth callback need
the `session` cookie set by `POST /api/auth/login` (httpOnly, sent automatically by the browser
with `credentials: "include"` / same-origin requests). Errors are JSON
`{"detail": "message"}` (FastAPI style; validation errors have `detail` as a list of
`{loc, msg}` objects). Timestamps are ISO-8601 strings in UTC.

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `User` (+ sets cookie) |
| POST | `/api/auth/logout` | – | 204 |
| GET | `/api/auth/me` | – | `User` or 401 |
| POST | `/api/auth/change-password` | `{current_password, new_password}` | 204 |

`User = {id: number, email: string}`

## Setup info

`GET /api/config` →
```json
{
  "public_base_url": "https://mybot.duckdns.org",
  "webhook_url": "https://mybot.duckdns.org/webhooks/instagram",
  "oauth_redirect_uri": "https://mybot.duckdns.org/api/instagram/oauth/callback",
  "instagram_app_configured": true,
  "graph_api_version": "v26.0"
}
```

## Instagram accounts

`Account = {id, ig_user_id, username, name|null, profile_picture_url|null, token_expires_at|null,
token_refreshed_at|null, webhooks_subscribed: bool, is_active: bool, last_error|null, created_at}`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/accounts` | – | `Account[]` |
| GET | `/api/instagram/oauth/start` | – | `{url}`: send the browser there to connect via Instagram login |
| GET | `/api/instagram/oauth/callback` | (Instagram redirects here) | 302 to `/accounts?connected=1` or `/accounts?error=...` |
| POST | `/api/accounts/token` | `{access_token}` | `Account`: connect with a token generated in the Meta App Dashboard |
| POST | `/api/accounts/{id}/subscribe` | – | `Account`: (re)subscribe the account to webhooks |
| POST | `/api/accounts/{id}/refresh-token` | – | `Account` |
| PATCH | `/api/accounts/{id}` | `{is_active}` | `Account` |
| DELETE | `/api/accounts/{id}` | – | 204 (deletes its automations, contacts, logs) |
| GET | `/api/accounts/{id}/media?after=<cursor>` | – | `{items: Media[], next: string|null}` |

`Media = {id, caption|null, media_type, media_product_type|null, media_url|null, thumbnail_url|null, permalink|null, timestamp|null}`
(for videos/reels use `thumbnail_url` as the preview image, otherwise `media_url`).

## Automations

```ts
type Automation = {
  id: number; account_id: number; name: string; is_active: boolean;
  trigger_type: "comment" | "dm_keyword";
  trigger: CommentTrigger | DMKeywordTrigger;
  flow: Flow;
  triggered_count: number; created_at: string; updated_at: string;
}
type CommentTrigger = {
  type: "comment";
  keywords: string[];
  match: "any" | "contains" | "exact";   // "any" = every comment
  media_ids: string[];                     // [] = all posts & reels
  public_replies: string[];                // one picked at random; [] = no public reply
  once_per_user: boolean;
  top_level_only: boolean;
}
type DMKeywordTrigger = { type: "dm_keyword"; keywords: string[]; match: "contains" | "exact" }

type Flow = { start_step_id: string; steps: Step[] }   // 1..50 steps, unique ids
type Button = { title: string /* ≤20 chars */; type: "step" | "url"; step_id?: string|null; url?: string|null }
type Step =
  | { id: string; label: string; type: "message"; text: string; buttons: Button[] /* ≤3 */; next_step_id: string|null }
  | { id: string; label: string; type: "card"; image_url: string; title: string /* ≤80 */; subtitle: string /* ≤80 */; buttons: Button[]; next_step_id: string|null }
  | { id: string; label: string; type: "delay"; seconds: number /* 1..82800 */; next_step_id: string|null }
  | { id: string; label: string; type: "follow_check"; following_step_id: string|null; not_following_step_id: string|null }
  | { id: string; label: string; type: "collect_input"; text: string; input_type: "email"|"phone"|"text"; field_name: string|null; retry_text: string; max_attempts: number; next_step_id: string|null }
  | { id: string; label: string; type: "add_tag"; tags: string[]; next_step_id: string|null }
```

Rules enforced by the server (422 with a readable `detail` otherwise):
* Message text ≤1000 bytes (≤640 when it has buttons). Placeholders `{first_name}`, `{name}`, `{username}`, `{email}`, `{phone}` are filled in.
* Every `step_id` / `next_step_id` / branch target must exist.
* Comment automations must start with a `message` or `card` step (sent as the private reply).
  Tip shown in the UI: give that first message a button, because Instagram only allows further
  messages once the person taps it or replies.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/automations?account_id=` | – | `Automation[]` |
| POST | `/api/automations` | `AutomationIn` | `Automation` |
| GET | `/api/automations/{id}` | – | `Automation` |
| PUT | `/api/automations/{id}` | `AutomationIn` | `Automation` |
| PATCH | `/api/automations/{id}/active` | `{is_active}` | `Automation` |
| POST | `/api/automations/{id}/duplicate` | – | `Automation` |
| DELETE | `/api/automations/{id}` | – | 204 |
| GET | `/api/automations/{id}/stats` | – | `{triggered, comments_matched, dms_sent, runs: {[status]: count}}` |

`AutomationIn = {account_id, name, is_active, trigger, flow}`

## Contacts

`Contact = {id, account_id, igsid, username|null, name|null, profile_pic|null, is_follower: bool|null,
email|null, phone|null, custom_fields: object, tags: string[], last_inbound_at|null, last_interaction_at|null, created_at}`

| Method | Path | Returns |
|---|---|---|
| GET | `/api/contacts?account_id=&q=&tag=&limit=50&offset=0` | `{items: Contact[], total}` (q searches username/name/email/phone) |
| GET | `/api/contacts/export.csv?account_id=` | CSV download |
| GET | `/api/contacts/{id}` | `Contact` |
| GET | `/api/contacts/{id}/messages` | `Message[]` oldest → newest (last 200) |
| GET | `/api/contacts/{id}/runs` | `Run[]` newest first |
| DELETE | `/api/contacts/{id}` | 204 |

`Message = {id, contact_id, direction: "in"|"out", kind, text|null, payload|null, automation_id|null, error|null, created_at}`
`Run = {id, automation_id, automation_name, contact_id, contact_username, status, current_step_id, steps_executed, error, created_at, updated_at}`
Run status: `running | waiting_button | waiting_reply | waiting_input | waiting_delay | completed | failed | cancelled`.

## Activity & stats

| Method | Path | Returns |
|---|---|---|
| GET | `/api/activity/comments?account_id=&status=&limit=50&offset=0` | `{items: CommentEvent[], total}` |
| GET | `/api/activity/runs?account_id=&status=&limit=50&offset=0` | `{items: Run[], total}` |
| GET | `/api/activity/webhooks?limit=50` | `{id, received_at, processed_at, error, payload}[]` |
| GET | `/api/activity/failed-jobs?limit=50` | `{id, type, attempts, last_error, updated_at}[]` |
| GET | `/api/stats?account_id=` | `Stats` |

`CommentEvent = {id, account_id, comment_id, media_id, text, from_username, contact_id, automation_id, automation_name, status: "no_match"|"matched"|"skipped_repeat"|"ignored"|"error", dm_sent, public_reply_id, error, created_at}`

```ts
type Stats = {
  contacts: number; automations_active: number;
  comments_24h: number; comments_matched_24h: number; dms_sent_24h: number;
  messages_in_24h: number; runs_failed_24h: number; emails_collected: number;
  daily: { date: string /* YYYY-MM-DD */; comments: number; dms_sent: number; new_contacts: number }[]  // last 14 days
}
```

## Webhooks (called by Meta)

* `GET /webhooks/instagram`: verification handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`)
* `POST /webhooks/instagram`: event delivery, checked against `X-Hub-Signature-256`

## Health

`GET /api/health` → `{"ok": true}`
