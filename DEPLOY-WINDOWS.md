# Deploying HR System to Windows Server

This guide walks through deploying the HR System to a **Windows Server** host
using Docker. The application itself runs as Linux containers (same images we
test against on every other platform); Windows Server only hosts the Docker
engine.

> **Recommended OS:** Windows Server 2022 or newer (required for Docker Desktop
> on Server). Windows Server 2019 also works but uses an older Docker stack.

---

## 1. Prerequisites — install once per server

### 1.1 Enable WSL 2

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
# Reboot when prompted.
wsl --set-default-version 2
wsl --update
```

Verify:

```powershell
wsl --status
# Default Version: 2  ← must say 2
```

### 1.2 Install Docker

Two options — pick one:

**Option A: Docker Desktop for Windows** (easiest, has GUI)
1. Download from <https://www.docker.com/products/docker-desktop/>
2. Install with default options. **Tick "Use WSL 2 instead of Hyper-V"** when asked.
3. After install, open Docker Desktop → Settings → General → tick **"Start Docker Desktop when you log in"**.
4. Settings → Resources → WSL Integration → enable for your default distro.

**Option B: Docker CE on WSL** (lighter, no GUI, runs as a service)
- Install Ubuntu inside WSL (`wsl --install -d Ubuntu`), then install Docker CE
  inside that distro following <https://docs.docker.com/engine/install/ubuntu/>.

Verify either option from PowerShell:

```powershell
docker version
docker compose version
```

Both must succeed.

### 1.3 Install Git

<https://git-scm.com/download/win> — accept defaults except:

- **Configuring the line ending conversions** → choose **"Checkout as-is, commit Unix-style line endings"**.

This pairs with our `.gitattributes` and avoids the #1 Windows-deployment
footgun (CRLF corrupting shell scripts and SQL migrations inside containers).

If you've already cloned and want to fix line endings retroactively:

```powershell
cd C:\path\to\hr-system
git rm --cached -r .
git reset --hard
```

### 1.4 Open firewall ports

PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "HR Frontend" -Direction Inbound -Protocol TCP -LocalPort 3040 -Action Allow
New-NetFirewallRule -DisplayName "HR Backend"  -Direction Inbound -Protocol TCP -LocalPort 3041 -Action Allow
```

Adjust ports if you mapped them differently in `docker-compose.prod.yml`.

### 1.5 Verify ZKTeco device reachability

The backend talks to the ZKTeco fingerprint device. From the **server**:

```powershell
Test-NetConnection 192.128.69.33 -Port 4370
# TcpTestSucceeded : True   ← required
```

If False: the server can't reach the device. Check VLAN / subnet / cabling
**before** starting the stack.

---

## 2. First-time deploy

### 2.1 Clone the repo

```powershell
cd C:\opt
git clone https://github.com/acid1010/hr-gas.git hr-system
cd hr-system
```

### 2.2 Configure environment

```powershell
copy .env.example .env
notepad .env
```

Required values (replace every `changeme` / `change-this-...`):

| Variable | What to set |
|---|---|
| `POSTGRES_PASSWORD` | Strong password for the in-cluster Postgres |
| `REDIS_PASSWORD` | Strong password for the in-cluster Redis |
| `JWT_SECRET` | Long random string. Generate: `openssl rand -hex 48` (or use any password generator) |
| `JWT_REFRESH` | Different long random string |
| `API_URL` | Public URL the **browser** will use to reach the backend, e.g. `http://hr.local:3041` or `http://10.0.0.50:3041`. **Not** an internal Docker hostname. |
| `ZK_IP` | ZKTeco device IP (default `192.128.69.33`) |
| `ZK_PORT` | ZKTeco device port (default `4370`) |

`DATABASE_URL` is **ignored** by the production compose file (the backend
auto-builds the connection string from `POSTGRES_PASSWORD` and the in-cluster
hostname `postgres:5432`). It only matters for the dev compose.

### 2.3 Build and start the stack

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes ~3–5 minutes. Watch progress:

```powershell
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

All four services should reach `(healthy)`:

```
NAME          STATUS
hr-postgres   Up X seconds (healthy)
hr-redis      Up X seconds (healthy)
hr-backend    Up X seconds (healthy)
hr-frontend   Up X seconds (healthy)
```

The `hr-migrate` container runs once, applies the SQL migrations, and exits —
this is expected; do not try to restart it.

### 2.4 Smoke test

From the server:

```powershell
curl http://127.0.0.1:3041/healthz
# {"status":"ok","uptime":...}

curl http://127.0.0.1:3040/
# Should return Next.js HTML
```

From a client machine on the LAN: open `http://<server-ip>:3040/` in a browser.

---

## 3. Day-to-day operations

### Start / stop / restart

```powershell
# Stop everything (data preserved in named volumes)
docker compose -f docker-compose.prod.yml stop

# Start again
docker compose -f docker-compose.prod.yml start

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Tear down completely (still preserves data volumes)
docker compose -f docker-compose.prod.yml down

# DESTROY data too — only do this if you know what you're doing
docker compose -f docker-compose.prod.yml down -v
```

### View logs

```powershell
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

### Update to a new version

```powershell
cd C:\opt\hr-system
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

The migration runner re-applies all migrations on every startup, but every
migration uses `IF NOT EXISTS` so this is safe and idempotent.

### Auto-start with Windows

- **Docker Desktop:** already configured in step 1.2 (starts with login). Containers
  themselves use `restart: unless-stopped` so they come back up on reboot.
- **Docker CE on WSL:** add Docker service to start on boot inside WSL, and
  configure WSL itself to start on Windows boot via Task Scheduler running
  `wsl --exec dockerd` at startup, OR run a small `nssm` service that does
  `docker compose -f docker-compose.prod.yml up`.

### Backups

Run on a schedule via **Task Scheduler** (Windows equivalent of cron):

```powershell
# Daily at 02:00 — back up the database to C:\backups
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
docker exec hr-postgres pg_dump -U postgres -d hr | Out-File "C:\backups\hr-$ts.sql" -Encoding utf8
```

Also back up the `backend-uploads` named volume periodically:

```powershell
docker run --rm -v hr-system_backend-uploads:/data -v C:\backups:/backup alpine `
  tar czf /backup/uploads-$(date +%Y%m%d).tgz -C /data .
```

---

## 4. Troubleshooting

### "no such file or directory: /usr/local/bin/dumb-init\r"

**Cause:** CRLF line endings sneaked into a script.
**Fix:** see step 1.3 — set `git config --global core.autocrlf input`, then
`git rm --cached -r . && git reset --hard` to re-checkout with LF endings.
Our `.gitattributes` prevents this on fresh clones.

### Backend container restarts forever

```powershell
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

Common causes:
- `JWT_SECRET` / `JWT_REFRESH` empty in `.env` → set them.
- Postgres password mismatch → ensure `POSTGRES_PASSWORD` is the same value
  used at first boot. If you changed it after Postgres initialized its data
  volume, reset with `docker compose -f docker-compose.prod.yml down -v`
  (⚠️ destroys data) and start fresh.

### Migrations fail

```powershell
docker logs hr-migrate
```

Inspect the offending SQL file under `backend/prisma/migrations/`. All
migrations should be idempotent (`CREATE ... IF NOT EXISTS`). If a hand-edited
migration broke this, fix it and re-run:

```powershell
docker compose -f docker-compose.prod.yml up -d migrate
```

### ZKTeco sync not pulling records

```powershell
docker compose -f docker-compose.prod.yml logs backend | Select-String -Pattern "zk|attendance" -CaseSensitive:$false
```

- Verify `ZK_IP` / `ZK_PORT` in `.env` match the device.
- From the server: `Test-NetConnection $env:ZK_IP -Port $env:ZK_PORT` — must succeed.
- The device may only allow one connection at a time; close any vendor software
  using it.

### Out of disk space

WSL 2 stores Docker volumes inside a virtual disk that grows but doesn't shrink.
After lots of image rebuilds:

```powershell
docker system prune -a --volumes   # ⚠️ removes unused images and dangling volumes
# Then optionally compact the WSL VHD (Docker Desktop → Settings → Resources → "Clean / Purge data")
```

---

## 5. Don't do these things on Windows

These are well-known footguns specific to Windows + Docker:

1. **Don't bind-mount `C:\...` paths into the Postgres container.** Use named
   volumes (which we do — `pgdata`). Bind-mounted Postgres data on Windows
   has fsync corruption issues.
2. **Don't run the Node.js app natively** (without Docker). `bcrypt` and
   `node-zklib` are native modules that need rebuilding on Windows and have
   historically been flaky there. The Docker path is much more reliable.
3. **Don't disable `restart: unless-stopped`.** Windows reboots for updates;
   you want containers to come back automatically.
4. **Don't expose Postgres or Redis ports to the LAN.** The compose file
   intentionally only publishes 3040/3041; Postgres + Redis are reachable
   only inside the `hr-net` Docker network.
5. **Don't edit Dockerfiles or shell scripts in Notepad** without a final
   blank line — Notepad sometimes adds a BOM that breaks shell parsing.
   Use VS Code (which respects our `.gitattributes`) or Notepad++.
