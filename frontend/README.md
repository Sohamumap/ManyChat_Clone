# FlowDM dashboard

React 19 + TypeScript + Vite + Tailwind CSS v4. Talks to the FastAPI backend over the same
origin (`/api`); the contract is in [../docs/API.md](../docs/API.md).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api and /webhooks to http://localhost:8000
npm run build      # type-check + production build into dist/
npm run typecheck
```

In production `deploy/web.Dockerfile` builds this folder and Caddy serves `dist/` (with SPA
fallback) next to the API.

* `src/pages/`: one file per route; the automation editor lives in `src/pages/editor/`
* `src/lib/templates.ts`: the quick-start automation templates
* `src/lib/flow.ts`: editor draft ↔ API flow conversion and validation
* `public/privacy.html`: privacy policy template required by Meta before going live.
  **Edit the [BRACKETED] parts** with your details.
