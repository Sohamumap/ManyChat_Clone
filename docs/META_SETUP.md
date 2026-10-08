# Connecting Instagram (Meta app setup)

FlowDM talks to Instagram through **your own Meta app**, using the official
*Instagram API with Instagram Login* (the same API ManyChat uses). You set the app up once.
It's free.

> **What you need first**
> * Your server running with HTTPS (see [DEPLOY_AWS.md](DEPLOY_AWS.md)). Meta only sends
>   webhooks to a public `https://` URL.
> * An Instagram **professional** account (Business or Creator).
>   In the Instagram app: *Settings → Account type and tools → Switch to professional account*.
> * In the Instagram app: *Settings → Messages and story replies → Message controls →
>   Connected tools → **Allow access to messages*** must be ON, or the API can't send DMs.

Your exact URLs are also shown in the dashboard under **Settings → Webhook setup**, ready to copy.

| What | Value |
|---|---|
| Webhook callback URL | `https://<your-domain>/webhooks/instagram` |
| Webhook verify token | shown in **Settings → Webhook setup** (copy button) |
| OAuth redirect URI | `https://<your-domain>/api/instagram/oauth/callback` |

---

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> and log in (create a developer account if asked).
2. **Create app** → choose the use case **"Manage messaging & content on Instagram"** → app type
   **Business** → give it a name.
   * Meta rejects app names containing "Insta", "Gram" or "Facebook". Use something like
     "YourBrand Messaging".
3. Open the app → **Use cases → Manage messaging & content on Instagram → Customize →
   API setup with Instagram login**. The steps below all happen on that page.

## 2. Paste the Instagram app ID and secret into FlowDM

On *API setup with Instagram login*, the top of the page shows **Instagram app ID** and
**Instagram app secret** (click *Show*). These are *not* the same as the Meta App ID on the
dashboard home.

In FlowDM open **Settings → Instagram app**, paste both, and click **Save**. Optionally also
paste the **Meta app secret** (Meta dashboard: *App settings → Basic → App secret*), which helps
verify webhooks. They're stored encrypted. No restart is needed.

<sub>Alternatively you can put them in the server's `.env` as `INSTAGRAM_APP_ID`,
`INSTAGRAM_APP_SECRET`, `META_APP_SECRET`. Values saved in the dashboard take precedence.</sub>

## 3. Add your Instagram account as a tester

While the app is in **Development** mode, only accounts with a role on the app can use it.

1. **App roles → Roles → Add People → Instagram Tester** → enter your Instagram username.
   Also add a *second* Instagram account (a friend's or a spare one) to test commenting from.
2. Accept each invite. In Instagram on the web: *Settings → Website permissions → Apps and
   websites → Tester invites → Accept* (or open
   <https://www.instagram.com/accounts/manage_access/>).

## 4. Configure webhooks

In section **"Configure webhooks"**:

1. **Callback URL**: `https://<your-domain>/webhooks/instagram`
2. **Verify token**: copy it from FlowDM **Settings → Webhook setup**
3. Click **Verify and save**. FlowDM answers Meta's check automatically. If it fails, make sure
   `https://<your-domain>/api/health` opens in your browser and the token matches exactly.
4. In the field list, **Subscribe** to: `comments`, `messages`, `messaging_postbacks`.

## 5. Set the OAuth redirect URI

In section **"Set up Instagram business login" → Business login settings**:

* **OAuth redirect URIs**: `https://<your-domain>/api/instagram/oauth/callback`
* Save.

## 6. Connect your account in FlowDM

Open your dashboard → **Settings** and either:

* **Connect with Instagram** (recommended): log in and approve the permissions, and you're
  sent back with the account connected. FlowDM stores the 60-day token encrypted and
  **refreshes it automatically** before it expires.
* **or Paste access token**: on the Meta page, section "Generate access tokens" →
  **Add account** → **Generate token** → copy it into FlowDM.

FlowDM subscribes the account to webhooks right after connecting. The account card should show
**Webhooks: subscribed**. If not, press *Subscribe webhooks* and read the error shown.

## 7. Test it

1. Create an automation (Automations → New → template *"Comment → DM link with follow-gate"*),
   keyword `LINK`, and save it as active.
2. From your **second (tester) account**, comment `LINK` on one of your posts or reels.
   Commenting from the business account itself is ignored on purpose.
3. Within a few seconds the commenter gets the DM, and the comment gets a public reply.
4. Check **Activity** in the dashboard. Every comment, decision and error is logged there,
   including the raw webhook payloads.

---

## 8. Going live (so anyone, not just testers, triggers your automations)

ManyChat has already done this step, which is part of what its subscription pays for. You have
to do it once for your own app. Meta's rules here change often, so treat this as a checklist and
follow what the App Dashboard asks for:

1. **App settings → Basic**: fill in *Privacy policy URL* (FlowDM ships a template at
   `https://<your-domain>/privacy.html`; edit `frontend/public/privacy.html` with your
   details), *User data deletion* (instructions URL; the same page has a section), app icon,
   category, and contact email.
2. Switch the app from **Development** to **Live** (toggle at the top of the dashboard).
3. **Test with a non-tester account.** Meta's docs say comment webhooks
   (`comments`) need **Advanced Access** for `instagram_business_manage_comments`, even if the
   app only serves your own account. DMs from the public may also need Advanced Access for
   `instagram_business_manage_messages`.
4. If comments or DMs from non-testers don't arrive, request **Advanced Access** under
   *App Review → Permissions and features* for:
   * `instagram_business_basic`
   * `instagram_business_manage_messages`
   * `instagram_business_manage_comments`

   This needs **Business Verification** (Meta Business Portfolio → Security Center; you'll
   upload business documents) and an **App Review** submission. For each permission, explain
   the use ("automatically reply by DM to people who comment a keyword on our posts") and
   attach a short screen recording showing: connecting the account in FlowDM, creating an
   automation, a comment triggering the DM, and the conversation in the dashboard. Give the
   reviewers a dashboard login (create a test password in Settings).

Review usually takes a few days. Until it's approved, everything still works for tester accounts,
so you can build and test all your automations.

## Instagram rules FlowDM follows for you

* **One private reply per comment**, within 7 days of the comment. After that first DM,
  Instagram allows nothing else until the person **taps a button or replies**. That's why
  templates start with a button like "Send me the link". The tap opens a **24-hour window** in
  which the rest of the flow can run.
* **Follow checks** only work after the person has tapped/replied (Instagram needs their
  consent before it reveals follow status). The follow-gate template is built that way.
* **Public replies** only work on top-level comments, not on replies to comments.
* **Rate limits**: about 750 private replies per hour per account. During a viral spike,
  FlowDM queues and retries automatically.
* **Outside the 24-hour window**, nothing can be sent. Delayed steps that would land outside
  it are marked failed in Activity rather than silently dropped.
