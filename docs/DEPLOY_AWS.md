# Deploying to AWS EC2 (free tier) with a free DuckDNS domain

This puts FlowDM on one small Ubuntu server: Postgres, the API, the background worker, and Caddy
(which serves the dashboard and gets a free HTTPS certificate automatically). Everything runs in
Docker, so the server needs very little setup. Expect about 30 minutes.

**Cost:** new AWS accounts get free-tier usage or credits. Check *Billing → Free Tier* in the
console for what your account has. Without them, a `t3.micro` costs about **$8/month**, plus
about $1.60/month for 20 GB of disk and about $3.60/month for the public IPv4 address. A
`t4g.micro` (ARM) is a bit cheaper and works too; all images are multi-architecture. The
whole stack uses about **250 MB of RAM**, so 1 GB is plenty.

---

## 1. Launch the server

AWS Console → **EC2 → Launch instance**:

| Setting | Value |
|---|---|
| Name | `flowdm` |
| OS image | **Ubuntu Server 24.04 LTS** (64-bit x86; or Arm for t4g) |
| Instance type | **t3.micro** (free-tier eligible) or t4g.micro |
| Key pair | Create one and download the `.pem` file. You need it to log in. |
| Network → Security group | Create one that allows: **SSH (22) from My IP**, **HTTP (80) from Anywhere**, **HTTPS (443) from Anywhere** |
| Storage | **20 GiB gp3** (free tier covers up to 30 GiB) |

Click **Launch instance**.

## 2. Give it a fixed IP address

EC2 → **Elastic IPs → Allocate Elastic IP address → Allocate**, then select it →
**Actions → Associate** → choose your `flowdm` instance. Note the IP (e.g. `3.110.12.34`).

Without this, the IP changes every time the instance stops. (If you skip it, use
`deploy/duckdns-update.sh` from cron to keep DuckDNS updated.)

## 3. Get a free domain from DuckDNS

1. Go to <https://www.duckdns.org> and sign in (GitHub/Google).
2. Add a subdomain, e.g. `mybrandbot` → you get **`mybrandbot.duckdns.org`**.
3. Put your Elastic IP in its *current ip* box → **update ip**.
4. Copy the **token** shown at the top (only needed for the optional auto-update script).

Check it resolves: `ping mybrandbot.duckdns.org` should show your Elastic IP.

## 4. Prepare the server

```bash
chmod 400 ~/Downloads/flowdm.pem
ssh -i ~/Downloads/flowdm.pem ubuntu@mybrandbot.duckdns.org
```

On the server:

```bash
# Get the code. For a private repo, use a GitHub personal access token (Settings → Developer
# settings → Fine-grained tokens, read-only "Contents" on this repo):
git clone https://<YOUR_GITHUB_TOKEN>@github.com/Sohamumap/ManyChat_Clone.git flowdm
cd flowdm

# Swap space, Docker, automatic security updates
sudo ./deploy/setup-ec2.sh
exit   # log out and back in so you can use docker without sudo
```

## 5. Configure

```bash
ssh -i ~/Downloads/flowdm.pem ubuntu@mybrandbot.duckdns.org
cd flowdm
./deploy/init-env.sh mybrandbot.duckdns.org you@example.com
```

This creates `.env` with random secrets and **prints your dashboard password. Save it.**
Then add your Instagram app credentials (see [META_SETUP.md](META_SETUP.md), step 2):

```bash
nano .env   # set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (and META_APP_SECRET)
```

## 6. Start it

```bash
docker compose up -d --build
```

The first build takes about 5–10 minutes on a t3.micro (later updates are faster). Then:

```bash
docker compose ps                 # all services "running" / "healthy"
docker compose logs -f web        # watch Caddy obtain the HTTPS certificate
```

Open **https://mybrandbot.duckdns.org** and log in with the email and password from step 5.
Change the password under **Settings**.

Then follow **[META_SETUP.md](META_SETUP.md)** to connect Instagram.

---

## Day-to-day operations

| Task | Command (run inside `~/flowdm`) |
|---|---|
| See what's running | `docker compose ps` |
| Live logs | `docker compose logs -f worker` (or `api`, `web`, `db`) |
| Update to the latest code | `./deploy/update.sh` (pulls, rebuilds, restarts; migrations run automatically) |
| Restart everything | `docker compose restart` |
| Stop | `docker compose down` (data is kept in Docker volumes) |
| Back up the database | `./deploy/backup.sh` → `backups/*.sql.gz` |
| Edit settings | `nano .env` then `docker compose up -d` |

**Automatic daily backups:** run `crontab -e` and add:

```
15 3 * * * /home/ubuntu/flowdm/deploy/backup.sh >/dev/null 2>&1
```

For off-server copies, sync `backups/` to S3 (`aws s3 sync backups s3://your-bucket/flowdm`)
or download them occasionally with `scp`.

## Troubleshooting

* **Site doesn't load / certificate errors**: check that `DOMAIN` in `.env` matches your DuckDNS
  name exactly, the DuckDNS IP equals the Elastic IP, and ports 80/443 are open in the
  security group. `docker compose logs web` shows Caddy's certificate attempts.
* **Meta says the callback URL couldn't be validated**: open
  `https://<domain>/api/health` in a browser (it must show `{"ok":true}`), and make sure the
  verify token matches `WEBHOOK_VERIFY_TOKEN` in `.env`.
* **Comments don't trigger anything**: open **Activity → Webhook log**. If nothing arrives,
  the webhook isn't subscribed (Settings → *Subscribe webhooks*) or the commenter isn't an
  Instagram tester while the app is in Development mode (see META_SETUP.md §8). If events
  arrive but nothing is sent, the Comments and Flow runs tabs show the reason.
* **Out of memory while building**: make sure swap is on (`free -h` should show 2 GB swap).
  `setup-ec2.sh` adds it.
