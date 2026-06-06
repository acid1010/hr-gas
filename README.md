# HR System — PT. Global Anugerah Setia

Internal HR management portal for PT. Global Anugerah Setia.

- **Frontend** — Next.js 16, Tailwind CSS, DaisyUI — runs on port **3040**
- **Backend** — Express 5, Prisma, PostgreSQL, Redis — runs on port **3041**

---

## Quick Start

There are two ways to run this system: **Manual** (recommended for development) or **Docker** (recommended for production).

---

## Option A — Manual Setup

### Step 1 — Prerequisites

Install these before continuing:

- [Node.js v20+](https://nodejs.org)
- PostgreSQL (database named `hr` must exist)
- Redis

Start Redis with Docker if you don't have it installed locally:

```bash
docker run -d --name hr-redis -p 6379:6379 \
  redis:7-alpine redis-server --requirepass "yourpassword"
```

---

### Step 2 — Backend

#### 2a. Create the environment file

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in your values:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/hr?sslmode=disable"
PORT=3041
JWT_SECRET="any-long-random-string"
JWT_REFRESH="another-long-random-string"
REDIS_URL="redis://:yourpassword@127.0.0.1:6379"
ZK_IP=192.128.69.33
ZK_PORT=4370
```

> `JWT_SECRET` and `JWT_REFRESH` can be any random string. Keep them secret and consistent.

#### 2b. Install dependencies and generate Prisma client

```bash
npm install
npx prisma generate
```

#### 2c. Run the database migration

Run this once to create the `attendance` table:

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260605_add_attendance/migration.sql
```

If `psql` is not in your PATH, open the file and run the SQL manually in your PostgreSQL client.

#### 2d. Create the first admin user

No default users exist. Run this once:

```bash
node -e "
const prisma = require('./libs/prisma');
const bcrypt = require('bcrypt');
bcrypt.hash('yourpassword', 10).then(hash =>
  prisma.users.create({ data: {
    name: 'Administrator',
    username: 'admin',
    hash,
    role: 'admin',
    access: 'superadmin',
    status: 'aktif',
  }}).then(u => { console.log('Created:', u.username); process.exit(); })
);
"
```

#### 2e. Start the backend

```bash
PORT=3041 node src/index.js
```

Or with PM2 for persistent background running:

```bash
npm install -g pm2
pm2 start src/index.js --name backend-hr -- --port 3041
pm2 save
```

The backend is ready when you see:
```
Redis connected successfully
Server is running on port 3041
```

---

### Step 3 — Frontend

#### 3a. Create the environment file

```bash
cd frontend
cp .env.example .env.local
```

Open `frontend/.env.local` and set:

```env
NEXT_PUBLIC_API_BASE_URL_PRODUCTION=http://localhost:3041
JWT_SECRET="any-long-random-string"
```

> `JWT_SECRET` must be the **same value** as in `backend/.env`.

#### 3b. Install dependencies

```bash
npm install
```

#### 3c. Start the frontend

Development mode (with hot reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

The frontend is ready when you see:
```
Ready on http://localhost:3040
```

---

### Step 4 — Open the app

Go to **http://localhost:3040/login** and sign in with the admin credentials you created in Step 2d.

---

## Option B — Docker (All-in-One)

Runs PostgreSQL, Redis, backend, and frontend in containers.

### Step 1 — Create environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` — at minimum set:
- `JWT_SECRET`
- `JWT_REFRESH`
- `POSTGRES_PASSWORD` (also set this in docker-compose.yml or via `.env` in the root)

Edit `frontend/.env.local` — set `JWT_SECRET` to match the backend.

### Step 2 — Build and start

```bash
docker compose up -d --build
```

Services started:
| Container | Port |
|-----------|------|
| hr-postgres | 5432 |
| hr-redis | 6379 |
| hr-backend | 3041 |
| hr-frontend | 3040 |

### Step 3 — Run the migration

Run once after the first boot:

```bash
docker exec -i hr-postgres psql -U postgres -d hr \
  < backend/prisma/migrations/20260605_add_attendance/migration.sql
```

### Step 4 — Create admin user

```bash
docker exec hr-backend node -e "
const prisma = require('./libs/prisma');
const bcrypt = require('bcrypt');
bcrypt.hash('yourpassword', 10).then(hash =>
  prisma.users.create({ data: {
    name: 'Administrator',
    username: 'admin',
    hash,
    role: 'admin',
    access: 'superadmin',
    status: 'aktif',
  }}).then(u => { console.log('Created:', u.username); process.exit(); })
);
"
```

### Step 5 — Open the app

Go to **http://localhost:3040/login**.

---

## TV Display

Open **http://your-server:3040/display** in a browser — no login required.

Shows the monthly employee performance leaderboard (top 5 and bottom 5), auto-refreshing every 5 minutes. Best for a large screen in the production floor or office.

---

## Fingerprint Device (ZKTeco X100-C)

The fingerprint machine must be on the **same local network** as the backend server.

| Setting | Value |
|---------|-------|
| Device IP | `192.128.69.33` |
| TCP Port | `4370` |

Before syncing, each employee must be enrolled on the device with their **NIK as their User ID** — this is how punch records are matched to database records.

To sync: open the **Attendance** page → click **Sync Device**.

To change the device IP/port, update `ZK_IP` and `ZK_PORT` in `backend/.env`.

---

## Troubleshooting

**`Server is running on port undefined`**
→ You forgot to set `PORT`. Run: `PORT=3041 node src/index.js`

**`Redis connection refused`**
→ Redis is not running. Start it: `docker start hr-redis`

**Login fails with correct credentials**
→ Check that `JWT_SECRET` is identical in both `backend/.env` and `frontend/.env.local`
→ Check that `NEXT_PUBLIC_API_BASE_URL_PRODUCTION` points to the running backend

**Device shows Offline**
→ Backend and device must be on the same subnet
→ Test: `ping 192.128.69.33` and `nc -zv 192.128.69.33 4370`

**Attendance shows "Unregistered"**
→ The employee's User ID on the device does not match their NIK in the database
→ Re-enroll the employee on the device using their exact NIK as the User ID

**PM2 logs**
```bash
pm2 logs backend-hr
pm2 restart backend-hr --update-env
```

---

## Field Reference

| Field | Valid values |
|-------|-------------|
| `status` | `aktif` / `non-aktif` |
| `worker_stats` | `pkwt` / `borongan` / `magang` |
| `section` | `manager` / `spv` / `admin` / `operator` |
| `departement` | `production` / `engineering` / `qc` / `maintenance` / `warehouse` / `hr` / `ga` / `it` |
| `access` | `-` / `user` / `admin` / `superadmin` |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Sign in |
| POST | `/auth/logout` | Sign out |
| POST | `/auth/refresh_token` | Refresh access token |
| GET | `/members` | List employees |
| POST | `/members` | Create employee |
| PUT | `/members/:id` | Update employee |
| PATCH | `/members/delete/:id` | Soft-delete employee |
| GET | `/members/export` | Download employees as CSV |
| POST | `/members/import` | Bulk import from CSV |
| GET | `/api/performance` | List performance records |
| POST | `/api/performance/post` | Add performance record |
| DELETE | `/api/performance/delete/:id` | Delete performance record |
| GET | `/api/performance/leaderboard?month=YYYY-MM` | Combined score ranking |
| GET | `/api/attendance?date=YYYY-MM-DD` | List attendance logs |
| POST | `/api/attendance/sync` | Pull records from ZKTeco device |
| GET | `/api/attendance/summary?month=YYYY-MM` | Days-present per employee |
| GET | `/api/attendance/device/info` | Check device connectivity |
| GET | `/api/attendance/report/excel?month=YYYY-MM` | Download monthly report as .xlsx |
