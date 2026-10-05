# Running FlowDM on your own computer

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or
Docker Engine (Linux). On Windows, run the commands in WSL or Git Bash.

## Option A: the full stack, same as the server

```bash
./deploy/init-env.sh                  # no domain → plain http://localhost
# add INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET to .env if you have them
docker compose up -d --build
```

Open <http://localhost> and log in with the password the script printed.

If port 80 is taken, set `HTTP_PORT=8080` in `.env`, use `PUBLIC_BASE_URL=http://localhost:8080`,
and open <http://localhost:8080>.

### Receiving Instagram webhooks on your laptop

Meta can only reach a public HTTPS URL. The quickest free option is a Cloudflare quick tunnel
(no account needed):

```bash
# install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:80
```

It prints a URL like `https://random-words.trycloudflare.com`. Set
`PUBLIC_BASE_URL=https://random-words.trycloudflare.com` in `.env`, run `docker compose up -d`,
and use that URL for the webhook and OAuth redirect in the Meta dashboard. The URL changes each
time you restart the tunnel, so this is for testing only.

## Option B: development mode (hot reload)

Run Postgres in Docker and the app directly:

```bash
docker run -d --name flowdm-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
docker exec flowdm-pg createdb -U postgres flowdm
docker exec flowdm-pg createdb -U postgres flowdm_test
```

**Backend** (Python 3.12+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cat > .env <<'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/flowdm
SECRET_KEY=dev-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
PUBLIC_BASE_URL=http://localhost:5173
WEBHOOK_VERIFY_TOKEN=dev-verify
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
EOF
alembic upgrade head
uvicorn app.main:app --reload --port 8000     # API + interactive docs at /api/docs
python -m app.jobs.worker                     # in a second terminal
```

**Frontend** (Node 20+), in a third terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
```

## Tests and checks

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/flowdm_test pytest
ruff check . && ruff format --check .

cd ../frontend
npm run build      # type-checks and builds
```

The backend tests use a fake Instagram client, so they never call Meta. They cover the comment →
DM flow, the follow-gate, email capture, delays, retries, duplicate webhook deliveries, and the
HTTP API.

## Database migrations

After changing `backend/app/models.py`:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Production applies migrations automatically when the `api` container starts.
