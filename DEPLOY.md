# Windows Server Deployment Guide

## Prerequisites

1. Install **Docker Desktop** for Windows  
   https://docs.docker.com/desktop/install/windows-install/  
   Enable "Use WSL 2 based engine" in Settings.

2. Open **Windows Firewall** ports:
   - `3040` — Frontend
   - `3041` — Backend API

---

## Step 1 — Copy project to server

Transfer the entire `hr-gas/` folder to the server (USB, shared drive, or `scp`).

---

## Step 2 — Configure `.env`

Edit `.env` in the project root. The only value that **must** be correct before building:

```
API_URL=http://<YOUR_SERVER_IP>:3041
```

Replace `<YOUR_SERVER_IP>` with the server's LAN IP (e.g. `192.168.1.50`) or domain name.  
Also generate strong secrets for `JWT_SECRET` and `JWT_REFRESH` (any long random string).

---

## Step 3 — Build and start

Open **PowerShell** or **Command Prompt** in the `hr-gas/` directory:

```powershell
docker compose up -d --build
```

First build takes ~5–10 minutes (downloads images, installs npm packages, compiles Next.js).

---

## Step 4 — Verify

```powershell
docker compose ps          # all services should be "running"
docker compose logs backend --tail=30
```

Open `http://localhost:3040` in a browser. Login: `mdata` / `gasjaya`.

---

## Updating the app

```powershell
docker compose down
# (copy new code files)
docker compose up -d --build
```

Data in PostgreSQL is preserved in the `postgres_data` Docker volume across rebuilds.

---

## Common issues

| Symptom | Fix |
|---------|-----|
| Frontend shows "Network Error" | `API_URL` in `.env` must be public IP, not `localhost` |
| Backend exits immediately | Check `docker compose logs backend` — likely DB not ready yet, just retry `docker compose up -d` |
| Login fails | Ensure `init.sql` ran (only runs on first boot). To force re-init: `docker compose down -v` then `up -d --build` |
| ZKTeco sync fails | Device and server must be on same network; check `ZK_IP` / `ZK_PORT` in `.env` |

---

## Reset everything (nuclear)

```powershell
docker compose down -v   # WARNING: deletes all database data
docker compose up -d --build
```
