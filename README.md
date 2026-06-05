# HR System — PT. Global Anugerah Setia

Internal HR management portal for PT. Global Anugerah Setia. Built with Next.js (frontend) and Express.js + Prisma (backend).

---

## Project Structure

```
hr-gas/
├── backend/    Express API, Prisma, PostgreSQL, Redis
└── frontend/   Next.js app
```

---

## Prerequisites

- Node.js v18+
- PostgreSQL (database must exist)
- Redis (local or Docker)
- PM2 (optional, for production)
- ZKTeco fingerprint device on the same local network (for attendance)

---

## 1 — Backend Setup

### Environment

Create `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hr?sslmode=disable"
PORT=3041
JWT_SECRET="your-access-token-secret"
JWT_REFRESH="your-refresh-token-secret"
REDIS_URL="redis://:yourpassword@127.0.0.1:6379"

# ZKTeco fingerprint device
ZK_IP=192.128.69.33
ZK_PORT=4370
```

### Start Redis (Docker)

```bash
docker run -d --name hr-redis -p 6379:6379 redis:7-alpine redis-server --requirepass "yourpassword"
```

### Install & Run

```bash
cd backend
npm install
npx prisma generate
node src/index.js
# or with PM2:
PORT=3041 pm2 start src/index.js --name backend-hr
```

### Run the Attendance Migration

The `attendance` table must be created before syncing the fingerprint device:

```sql
-- Run this once on your PostgreSQL database
-- File: backend/prisma/migrations/20260605_add_attendance/migration.sql

CREATE TABLE IF NOT EXISTS "attendance" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID,
    "device_uid" VARCHAR(50),
    "punch_time" TIMESTAMP(6) NOT NULL,
    "punch_type" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attendance_device_uid_punch_time_key" UNIQUE ("device_uid", "punch_time")
);

ALTER TABLE "attendance"
    ADD CONSTRAINT "attendance_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
```

Or run via psql:

```bash
psql $DATABASE_URL -f backend/prisma/migrations/20260605_add_attendance/migration.sql
```

### Seed an Admin User

No default users are created. Run this once to create an admin account:

```bash
cd backend
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
  }}).then(u => { console.log('Created:', u.username); process.exit(); })
);
"
```

---

## 2 — Frontend Setup

### Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL_PRODUCTION=http://localhost:3041
JWT_SECRET="your-access-token-secret"
```

> `JWT_SECRET` must match the backend value — the frontend uses it to decode the token server-side in `layout.js`.

### Install & Run

```bash
cd frontend
npm install
npm run dev        # development — http://localhost:3000
npm run build && npm start   # production
```

---

## 3 — Login

Open `http://localhost:3000/login` and sign in with the credentials you seeded above.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Sign in, sets JWT cookies |
| POST | `/auth/logout` | Clear cookies |
| POST | `/auth/refresh_token` | Refresh access token |
| GET | `/members` | List employees (paginated, searchable) |
| POST | `/members` | Create employee |
| PUT | `/members/:id` | Update employee |
| PATCH | `/members/delete/:id` | Soft-delete employee |
| GET | `/members/export` | Download all employees as CSV |
| POST | `/members/import` | Bulk-create employees from JSON array |
| GET | `/api/performance` | List performance records |
| POST | `/api/performance/post` | Create performance record |
| DELETE | `/api/performance/delete/:id` | Delete performance record |
| GET | `/api/attendance` | List attendance logs (date/user filter) |
| POST | `/api/attendance/sync` | Pull logs from ZKTeco device into DB |
| GET | `/api/attendance/summary` | Per-user days-present count by month |
| GET | `/api/attendance/device/info` | Check device connectivity |

---

## Import / Export Employees

### Export

Click **Export** on the Employee page — downloads `employees_YYYY-MM-DD.csv` with columns:

```
nik, name, join_date, status, section, departement, worker_stats, email, username, role, access
```

### Import

1. Prepare a CSV with the same columns as the export (header row required)
2. Click **Import** on the Employee page and select the file
3. Duplicate NIKs are skipped; results are shown in an alert

---

## Fingerprint Attendance (ZKTeco X100-C)

### Device Setup

The device must be on the same local network as the backend server.

Default device settings (from device screen):
| Setting | Value |
|---------|-------|
| IP Address | `192.128.69.33` |
| TCP COMM Port | `4370` |
| DHCP | OFF (static) |

To use a different device IP or port, update `ZK_IP` and `ZK_PORT` in `backend/.env`.

### Register Employees on the Device

Each employee must be enrolled on the fingerprint device with their **NIK as their User ID**. This is how the sync matches device punch records to employees in the database.

### Syncing Attendance

1. Open the **Attendance** page in the HR portal
2. The device status indicator shows **Online** if the backend can reach `192.128.69.33:4370`
3. Click **Sync Device** — pulls all stored punch records from the machine
4. Records are matched to employees by NIK; unmatched punches show as "Unregistered"
5. Duplicate punches (same device UID + timestamp) are automatically skipped

### Punch Types

| Type | Meaning |
|------|---------|
| `0` | Check In |
| `1` | Check Out |

### Attendance Summary (for Performance)

`GET /api/attendance/summary?month=YYYY-MM` returns days-present per employee for the given month, which can be used to inform quarterly performance scoring.

---

## Employee Field Reference

| Field | Values |
|-------|--------|
| `status` | `aktif` / `non-aktif` |
| `worker_stats` | `magang` / `borongan` / `pkwt` |
| `section` | `manager` / `spv` / `admin` / `operator` |
| `departement` | `production` / `engineering` / `qc` / `maintenance` / `warehouse` / `hr` / `ga` / `it` |
| `access` | `-` / `user` / `admin` / `superadmin` |

---

## Troubleshooting

**Redis connection refused**
```bash
docker start hr-redis
pm2 restart backend-hr
```

**`Server is running on port undefined`**
```bash
PORT=3041 pm2 restart backend-hr --update-env
```

**Login fails with correct credentials**
- Confirm the backend is running and `NEXT_PUBLIC_API_BASE_URL_PRODUCTION` points to it
- Check that `JWT_SECRET` matches on both sides

**Device shows Offline on the Attendance page**
- Confirm backend server and device are on the same network subnet
- Ping the device: `ping 192.128.69.33`
- Check the TCP port is reachable: `nc -zv 192.128.69.33 4370`
- Verify `ZK_IP` and `ZK_PORT` in `backend/.env` match the device screen

**Attendance records show "Unregistered"**
- The employee's User ID on the ZKTeco device does not match their NIK in the database
- Re-enroll the employee on the device using their exact NIK as the User ID

**Sync button does nothing / times out**
- Device may be busy or sleeping — wake it and retry
- Check PM2 logs: `pm2 logs backend-hr`
