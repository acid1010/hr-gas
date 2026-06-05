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
