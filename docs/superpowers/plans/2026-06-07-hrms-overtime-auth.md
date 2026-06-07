# HRMS Module 1 — Auth Foundation + Overtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real backend JWT authorization and a 2-step overtime approval module (supervisor submits batch → admin approves) with Excel export for payroll.

**Architecture:** Express middleware verifies the `accessToken` cookie and attaches `req.user`; role guards gate routes. Overtime uses a header+line model (`overtime_request` + `overtime_line`) so a supervisor can submit a batch of workers and an admin approves the whole batch. Frontend reads its role from a new `/auth/me` endpoint (httpOnly cookie can't be read client-side).

**Tech Stack:** Express 5, Prisma 6 (PostgreSQL), jsonwebtoken, cookie-parser, xlsx, Next.js 16 (App Router, client components), node:test (backend tests).

**Verified facts (from live codebase):**
- DB roles today: `role="admin"` (one account, `access="superadmin"`); all other users `role=null`. **No `"supervisor"` value exists yet** — supervisor accounts get `role="supervisor"`.
- JWT payload uses key `roleuser` (not `role`): `{id, username, roleuser, depart, section, access}`.
- Prisma singleton: `backend/libs/prisma.js`, imported as `../../libs/prisma` from routes. Root `libs/` is dead.
- `cookie-parser` NOT installed. No test framework (`npm test` is a stub).
- Auth refresh is broken: frontend calls `POST /auth/refresh` (no body); backend is `/auth/refresh_token` reading `req.body.refreshToken` (token is in httpOnly cookie, never body).
- xlsx export pattern: `XLSX.utils.json_to_sheet(rows)` → `XLSX.write(wb,{type:"buffer",bookType:"xlsx"})` → `res.send(buf)`.

---

## File Structure

**Backend:**
- Create `backend/src/middleware/auth.js` — `authMiddleware`, `requireRole`.
- Create `backend/src/routes/overtime.js` — overtime API (replaces empty 0-byte stub).
- Create `backend/prisma/migrations/20260607_overtime_module/migration.sql` — drop old OT tables, create new.
- Modify `backend/src/index.js` — cookie-parser, mount middleware, mount overtime route.
- Modify `backend/src/routes/auth.js` — fix refresh (cookie-based), add `/auth/me`.
- Modify `backend/prisma/schema.prisma` — replace OT models.
- Create `backend/tests/auth.test.js`, `backend/tests/overtime.test.js`.
- Modify `backend/package.json` — add deps, test script.

**Frontend:**
- Modify `frontend/src/lib/fetchWithAuth.js` — fix refresh path.
- Rewrite `frontend/src/app/overtime/page.jsx` — role-aware overtime UI.
- Create `frontend/src/app/overtime/OvertimeForm.jsx` — batch submit form (drawer content).

---

## Part A — Auth Foundation

### Task A1: Install deps + test framework

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install cookie-parser + supertest (dev)**

Run from `backend/`:
```bash
npm install cookie-parser
npm install --save-dev supertest
```
Expected: both added to package.json. (Tests use built-in `node:test` + `node:assert`; supertest drives the Express app in-process.)

- [ ] **Step 2: Add test script**

Edit `backend/package.json` `scripts`:
```json
"scripts": {
  "test": "node --test"
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add cookie-parser + node:test/supertest setup"
```

---

### Task A2: Auth middleware

**Files:**
- Create: `backend/src/middleware/auth.js`
- Test: `backend/tests/auth.middleware.test.js`

- [ ] **Step 1: Write failing test**

Create `backend/tests/auth.middleware.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const { authMiddleware, requireRole } = require("../src/middleware/auth");

function appWith(handlerGuards) {
  const app = express();
  app.use(cookieParser());
  app.get("/p", ...handlerGuards, (req, res) => res.json({ user: req.user }));
  return app;
}
function tokenFor(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "20m" });
}

test("401 when no token", async () => {
  const res = await request(appWith([authMiddleware])).get("/p");
  assert.strictEqual(res.status, 401);
});

test("401 when token invalid", async () => {
  const res = await request(appWith([authMiddleware]))
    .get("/p").set("Cookie", "accessToken=garbage");
  assert.strictEqual(res.status, 401);
});

test("attaches req.user when valid", async () => {
  const t = tokenFor({ id: "u1", username: "bob", roleuser: "admin" });
  const res = await request(appWith([authMiddleware]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.roleuser, "admin");
});

test("requireRole 403 for wrong role", async () => {
  const t = tokenFor({ id: "u2", roleuser: "supervisor" });
  const res = await request(appWith([authMiddleware, requireRole("admin")]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 403);
});

test("requireRole passes for allowed role", async () => {
  const t = tokenFor({ id: "u3", roleuser: "admin" });
  const res = await request(appWith([authMiddleware, requireRole("admin", "supervisor")]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 200);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && node --test tests/auth.middleware.test.js`
Expected: FAIL — `Cannot find module '../src/middleware/auth'`.

- [ ] **Step 3: Implement middleware**

Create `backend/src/middleware/auth.js`:
```js
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.roleuser)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

module.exports = { authMiddleware, requireRole };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && node --test tests/auth.middleware.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.js backend/tests/auth.middleware.test.js
git commit -m "feat: add JWT auth middleware + role guard"
```

---

### Task A3: Fix refresh + add /auth/me

**Files:**
- Modify: `backend/src/routes/auth.js`

- [ ] **Step 1: Fix refresh_token to read cookie + set cookie**

In `backend/src/routes/auth.js`, replace the `router.post("/refresh_token", ...)` handler body so it reads the cookie instead of the body:
```js
router.post("/refresh_token", (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH);
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        username: decoded.username,
        roleuser: decoded.roleuser,
        depart: decoded.depart,
        section: decoded.section,
        access: decoded.access,
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 20 * 60 * 1000,
    });
    res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: "Refresh token invalid" });
  }
});
```

- [ ] **Step 2: Add /auth/me (so frontend learns its role)**

Add before `module.exports = router;` in `backend/src/routes/auth.js`:
```js
const { authMiddleware } = require("../middleware/auth");

router.get("/me", authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    roleuser: req.user.roleuser,
    depart: req.user.depart,
    section: req.user.section,
    access: req.user.access,
  });
});
```

- [ ] **Step 3: Fix login refresh cookie path (logout bug)**

In the `logout` handler, the refreshToken is cleared with `{ path: "/auth/refresh" }` but it was never set with a path. Change the clear to match the set (no path):
```js
res.clearCookie("accessToken");
res.clearCookie("refreshToken");
return res.status(200).json({ message: "logout success" });
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "fix: refresh from httpOnly cookie, add /auth/me, fix logout clear"
```

---

### Task A4: Wire cookie-parser + middleware in index.js

**Files:**
- Modify: `backend/src/index.js`

- [ ] **Step 1: Add cookie-parser + protect routes**

In `backend/src/index.js`:

Add require near top (after `cors`):
```js
const cookieParser = require("cookie-parser");
const { authMiddleware } = require("./middleware/auth");
const overtimeRoutes = require("./routes/overtime");
```

After `app.use(express.urlencoded(...))` add:
```js
app.use(cookieParser());
```

Change the route mounts so everything except `/auth` requires a valid token:
```js
app.use("/auth", authRoutes);
app.use("/members", authMiddleware, membersRoutes);
app.use("/api/performance", authMiddleware, performanceRoutes);
app.use("/api/attendance", authMiddleware, attendanceRoutes);
app.use("/api/overtime", authMiddleware, overtimeRoutes);
```
(`/display` and the TV leaderboard call performance endpoints unauthenticated — see Step 2.)

- [ ] **Step 2: Keep the public leaderboard reachable for /display TV screens**

The `/display` page is intentionally unauthenticated (CLAUDE.md). It calls `GET /api/performance/leaderboard`. Mount that one sub-path BEFORE the protected `/api/performance` mount so it stays open:
```js
const performanceRouter = require("./routes/performance");
// public: TV display leaderboard (no auth)
app.use("/api/performance/leaderboard", performanceRouter);
// protected: everything else under /api/performance
app.use("/api/performance", authMiddleware, performanceRouter);
```
Note: Express matches in order; `/api/performance/leaderboard` resolves on the public mount first because the router's own `GET /leaderboard` handler matches at the mounted base. Verify manually in Task A5. If ordering proves unreliable, fall back to adding a per-route skip inside performance.js instead.

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.js
git commit -m "feat: mount cookie-parser + auth middleware on protected routes"
```

---

### Task A5: Manual auth smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start backend**

Run: `cd backend && PORT=3041 node src/index.js`
Expected: "Redis connected", "Server is running on port 3041". (Redis must be up — `docker compose up -d redis` if not.)

- [ ] **Step 2: Unauthenticated request is blocked**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3041/members`
Expected: `401`.

- [ ] **Step 3: Login then call protected route**

```bash
curl -s -c /tmp/cj.txt -X POST http://localhost:3041/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<known-admin-username>","password":"<password>"}'
curl -s -b /tmp/cj.txt -o /dev/null -w "%{http_code}\n" http://localhost:3041/members
curl -s -b /tmp/cj.txt http://localhost:3041/auth/me
```
Expected: members → `200`; `/auth/me` → JSON with `"roleuser":"admin"`.

- [ ] **Step 4: Public leaderboard still open**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3041/api/performance/leaderboard`
Expected: `200` (no cookie).

- [ ] **Step 5: Fix frontend refresh path**

In `frontend/src/lib/fetchWithAuth.js`, change:
```js
const refreshRes = await fetch(`${apiBaseUrl}/auth/refresh`, {
```
to:
```js
const refreshRes = await fetch(`${apiBaseUrl}/auth/refresh_token`, {
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/fetchWithAuth.js
git commit -m "fix: align frontend refresh call to /auth/refresh_token"
```

---

## Part B — Overtime Data Model

### Task B1: Write the migration SQL

**Files:**
- Create: `backend/prisma/migrations/20260607_overtime_module/migration.sql`

- [ ] **Step 1: Write migration**

Create `backend/prisma/migrations/20260607_overtime_module/migration.sql`:
```sql
-- Drop broken legacy overtime tables (child-first for FK order)
DROP TABLE IF EXISTS "overtime_detail" CASCADE;
DROP TABLE IF EXISTS "overtime" CASCADE;
DROP TABLE IF EXISTS "overtime_permit" CASCADE;

-- Header: one row per submitted batch
CREATE TABLE "overtime_request" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "submitted_by"  UUID NOT NULL REFERENCES "users"("id"),
  "departement"   VARCHAR(255),
  "date"          DATE NOT NULL,
  "shift"         INTEGER,
  "status"        VARCHAR(20) NOT NULL DEFAULT 'pending',
  "approved_by"   UUID REFERENCES "users"("id"),
  "approved_at"   TIMESTAMP(6),
  "reject_reason" VARCHAR(255),
  "created_at"    TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMP(6) NOT NULL DEFAULT now()
);

-- Line: one row per worker within a batch
CREATE TABLE "overtime_line" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL REFERENCES "overtime_request"("id") ON DELETE CASCADE,
  "user_id"    UUID NOT NULL REFERENCES "users"("id"),
  "start_time" TIMESTAMP(6) NOT NULL,
  "end_time"   TIMESTAMP(6) NOT NULL,
  "hours"      DECIMAL(5,2) NOT NULL,
  "reason"     VARCHAR(255),
  "multiplier" DECIMAL(4,2),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "idx_ot_request_status" ON "overtime_request"("status");
CREATE INDEX "idx_ot_request_submitted_by" ON "overtime_request"("submitted_by");
CREATE INDEX "idx_ot_request_date" ON "overtime_request"("date");
CREATE INDEX "idx_ot_line_request" ON "overtime_line"("request_id");
CREATE INDEX "idx_ot_line_user" ON "overtime_line"("user_id");
```

- [ ] **Step 2: Apply migration to DB**

Run:
```bash
cd backend
psql "$DATABASE_URL" -f prisma/migrations/20260607_overtime_module/migration.sql
```
Expected: `DROP TABLE` ×3, `CREATE TABLE` ×2, `CREATE INDEX` ×5, no errors.
(If `psql` not on host, use Docker: `docker exec -i hr-postgres psql -U postgres -d hr < prisma/migrations/20260607_overtime_module/migration.sql`.)

- [ ] **Step 3: Verify tables exist**

Run: `psql "$DATABASE_URL" -c "\d overtime_request" -c "\d overtime_line"`
Expected: both tables listed with the columns above.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260607_overtime_module/migration.sql
git commit -m "feat: migration — replace legacy overtime tables with request/line model"
```

---

### Task B2: Update Prisma schema + regenerate

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Remove legacy models, add new**

In `backend/prisma/schema.prisma`, DELETE the three models `overtime_permit`, `overtime`, `overtime_detail`. ADD:
```prisma
model overtime_request {
  id            String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  submitted_by  String          @db.Uuid
  departement   String?         @db.VarChar(255)
  date          DateTime        @db.Date
  shift         Int?
  status        String          @default("pending") @db.VarChar(20)
  approved_by   String?         @db.Uuid
  approved_at   DateTime?       @db.Timestamp(6)
  reject_reason String?         @db.VarChar(255)
  created_at    DateTime        @default(now()) @db.Timestamp(6)
  updated_at    DateTime        @default(now()) @db.Timestamp(6)
  submitter     users           @relation("ot_submitter", fields: [submitted_by], references: [id], onDelete: NoAction, onUpdate: NoAction)
  approver      users?          @relation("ot_approver", fields: [approved_by], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lines         overtime_line[]
}

model overtime_line {
  id         String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  request_id String           @db.Uuid
  user_id    String           @db.Uuid
  start_time DateTime         @db.Timestamp(6)
  end_time   DateTime         @db.Timestamp(6)
  hours      Decimal          @db.Decimal(5, 2)
  reason     String?          @db.VarChar(255)
  multiplier Decimal?         @db.Decimal(4, 2)
  created_at DateTime         @default(now()) @db.Timestamp(6)
  request    overtime_request @relation(fields: [request_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  worker     users            @relation("ot_worker", fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}
```

- [ ] **Step 2: Update `users` model relations**

In the `users` model, REMOVE the old lines:
```prisma
  overtime_detail overtime_detail[]
  overtime_permit overtime_permit[]
```
ADD (named relations matching above):
```prisma
  ot_submitted overtime_request[] @relation("ot_submitter")
  ot_approved  overtime_request[] @relation("ot_approver")
  ot_lines     overtime_line[]    @relation("ot_worker")
```

- [ ] **Step 3: Regenerate client**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client". No relation errors.

- [ ] **Step 4: Sanity check the client knows the models**

Run:
```bash
cd backend && node -e "const p=require('./libs/prisma'); console.log(typeof p.overtime_request.findMany, typeof p.overtime_line.create); process.exit(0)"
```
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: prisma models for overtime_request + overtime_line"
```

---

## Part C — Overtime API (`/api/overtime`)

All handlers assume `authMiddleware` already ran (mounted in Task A4), so `req.user` is set with `{id, roleuser, depart, ...}`.

Helper conventions used in this route:
- `isAdmin(req)` → `req.user.roleuser === "admin"`.
- Supervisors may only act on requests where `submitted_by === req.user.id`.
- `hours` computed server-side: `(end - start) / 3600000`, rounded to 2 decimals.

### Task C1: Create route skeleton + POST (create batch)

**Files:**
- Create: `backend/src/routes/overtime.js`
- Test: `backend/tests/overtime.test.js`

- [ ] **Step 1: Write failing test for hours calc + create**

Create `backend/tests/overtime.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const { computeHours } = require("../src/routes/overtime");

test("computeHours: 2.5h span", () => {
  const h = computeHours("2026-06-07T18:00:00", "2026-06-07T20:30:00");
  assert.strictEqual(h, 2.5);
});

test("computeHours: rounds to 2 decimals", () => {
  const h = computeHours("2026-06-07T18:00:00", "2026-06-07T19:20:00");
  assert.strictEqual(h, 1.33);
});

test("computeHours: throws if end <= start", () => {
  assert.throws(() => computeHours("2026-06-07T20:00:00", "2026-06-07T18:00:00"));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && node --test tests/overtime.test.js`
Expected: FAIL — `computeHours is not a function`.

- [ ] **Step 3: Implement route file with POST + exported helper**

Create `backend/src/routes/overtime.js`:
```js
const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

function computeHours(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!(e > s)) throw new Error("end_time must be after start_time");
  return Math.round(((e - s) / 3600000) * 100) / 100;
}

function isAdmin(req) {
  return req.user?.roleuser === "admin";
}

// POST / — supervisor or admin creates a batch (status=pending)
router.post("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { departement, date, shift, lines } = req.body;
    if (!date || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "date and at least one line required" });
    }
    const lineData = lines.map((l) => ({
      user_id: l.user_id,
      start_time: new Date(l.start_time),
      end_time: new Date(l.end_time),
      hours: computeHours(l.start_time, l.end_time),
      reason: l.reason || null,
    }));
    const created = await prisma.overtime_request.create({
      data: {
        submitted_by: req.user.id,
        departement: departement || req.user.depart || null,
        date: new Date(date),
        shift: shift != null ? Number(shift) : null,
        status: "pending",
        lines: { create: lineData },
      },
      include: { lines: true },
    });
    res.status(201).json({ message: "Overtime request created", data: created });
  } catch (error) {
    if (error.message.includes("end_time")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
module.exports.computeHours = computeHours;
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && node --test tests/overtime.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/overtime.js backend/tests/overtime.test.js
git commit -m "feat: overtime route + POST create batch with hours calc"
```

---

### Task C2: GET list (role-scoped) + GET :id

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Add GET / and GET /:id before `module.exports`**

Insert into `backend/src/routes/overtime.js` (after the POST handler, before `module.exports`):
```js
// GET / — list. Supervisor sees own; admin sees all. Filters: status, date, dept.
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { status, date, departement } = req.query;
    const where = {
      ...(isAdmin(req) ? {} : { submitted_by: req.user.id }),
      ...(status && { status }),
      ...(date && { date: new Date(date) }),
      ...(departement && { departement: { contains: departement, mode: "insensitive" } }),
    };
    const data = await prisma.overtime_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /:id — one request. Supervisor only if owner; admin any.
router.get("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await prisma.overtime_request.findUnique({
      where: { id: req.params.id },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isAdmin(req) && r.submitted_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.status(200).json({ data: r });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: overtime list (role-scoped) + detail endpoints"
```

---

### Task C3: Approve / reject (admin only)

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Add approve + reject handlers before `module.exports`**

```js
// PATCH /:id/approve — admin only
router.patch("/:id/approve", requireRole("admin"), async (req, res) => {
  try {
    const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot approve a ${r.status} request` });
    }
    const updated = await prisma.overtime_request.update({
      where: { id: req.params.id },
      data: { status: "approved", approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
    });
    res.status(200).json({ message: "Approved", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /:id/reject — admin only, requires reason
router.patch("/:id/reject", requireRole("admin"), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "reject reason required" });
    }
    const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot reject a ${r.status} request` });
    }
    const updated = await prisma.overtime_request.update({
      where: { id: req.params.id },
      data: { status: "rejected", reject_reason: reason.trim(), approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
    });
    res.status(200).json({ message: "Rejected", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: overtime approve/reject (admin only) with state guards"
```

---

### Task C4: Edit + delete (pending-only, owner/admin)

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Add PUT + DELETE handlers before `module.exports`**

```js
// shared guard: load request, enforce owner/admin + pending
async function loadEditable(req, res) {
  const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
  if (!r) { res.status(404).json({ error: "Not found" }); return null; }
  if (!isAdmin(req) && r.submitted_by !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return null;
  }
  if (r.status !== "pending") {
    res.status(409).json({ error: `Cannot modify a ${r.status} request` }); return null;
  }
  return r;
}

// PUT /:id — replace lines + header fields (pending only)
router.put("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    const { departement, date, shift, lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "at least one line required" });
    }
    const lineData = lines.map((l) => ({
      user_id: l.user_id,
      start_time: new Date(l.start_time),
      end_time: new Date(l.end_time),
      hours: computeHours(l.start_time, l.end_time),
      reason: l.reason || null,
    }));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.overtime_line.deleteMany({ where: { request_id: r.id } });
      return tx.overtime_request.update({
        where: { id: r.id },
        data: {
          departement: departement ?? r.departement,
          date: date ? new Date(date) : r.date,
          shift: shift != null ? Number(shift) : r.shift,
          updated_at: new Date(),
          lines: { create: lineData },
        },
        include: { lines: true },
      });
    });
    res.status(200).json({ message: "Updated", data: updated });
  } catch (error) {
    if (error.message.includes("end_time")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — pending only, owner/admin (lines cascade)
router.delete("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    await prisma.overtime_request.delete({ where: { id: r.id } });
    res.status(200).json({ message: "Deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: overtime edit/delete (pending-only, owner or admin)"
```

---

### Task C5: Excel export (admin only)

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Add xlsx require at top of file**

At the top of `backend/src/routes/overtime.js`, after the existing requires:
```js
const XLSX = require("xlsx");
```

- [ ] **Step 2: Add export handler BEFORE the `/:id` route**

Place this ABOVE `router.get("/:id", ...)` so `/export/excel` is not captured by `:id`:
```js
// GET /export/excel?month=YYYY-MM — admin only. Approved overtime for payroll.
router.get("/export/excel", requireRole("admin"), async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const requests = await prisma.overtime_request.findMany({
      where: { status: "approved", date: { gte: start, lt: end } },
      include: { lines: { include: { worker: { select: { name: true, nik: true } } } } },
      orderBy: { date: "asc" },
    });

    const rows = [];
    for (const r of requests) {
      for (const l of r.lines) {
        rows.push({
          NIK: l.worker?.nik ? String(l.worker.nik) : "",
          Nama: l.worker?.name || "",
          Departemen: r.departement || "",
          Tanggal: new Date(r.date).toISOString().slice(0, 10),
          "Jam Mulai": new Date(l.start_time).toISOString().slice(11, 16),
          "Jam Selesai": new Date(l.end_time).toISOString().slice(11, 16),
          "Total Jam": Number(l.hours),
          Pengali: l.multiplier != null ? Number(l.multiplier) : "",
          Keterangan: l.reason || "",
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, `Lembur ${month}`);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="lembur_${month}.xlsx"`);
    res.status(200).send(buf);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
```

- [ ] **Step 3: Manual API round-trip test**

With backend running and an admin cookie jar from Task A5 (`/tmp/cj.txt`):
```bash
BASE=http://localhost:3041
# get two real user ids
psql "$DATABASE_URL" -c "SELECT id,name FROM users WHERE deletedAt IS NULL LIMIT 2;"
# create (replace <uid> with a real users.id)
curl -s -b /tmp/cj.txt -X POST $BASE/api/overtime -H "Content-Type: application/json" -d '{
  "departement":"Production","date":"2026-06-07","shift":1,
  "lines":[{"user_id":"<uid>","start_time":"2026-06-07T18:00:00","end_time":"2026-06-07T20:30:00","reason":"line catch-up"}]
}'
# list
curl -s -b /tmp/cj.txt $BASE/api/overtime | head -c 400; echo
# approve (replace <reqid>)
curl -s -b /tmp/cj.txt -X PATCH $BASE/api/overtime/<reqid>/approve
# export
curl -s -b /tmp/cj.txt "$BASE/api/overtime/export/excel?month=2026-06" -o /tmp/lembur.xlsx -w "%{http_code}\n"
```
Expected: create → 201 with `hours:2.5`; list → JSON; approve → 200 status approved; export → 200, `/tmp/lembur.xlsx` non-empty.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: overtime monthly Excel export for payroll (admin only)"
```

---

## Part D — Overtime Frontend

The page reads its role from `GET /auth/me` (the accessToken cookie is httpOnly — not readable in client JS). `fetchWithAuth` already sends cookies (`credentials:"include"`).

### Task D1: Batch submit form component

**Files:**
- Create: `frontend/src/app/overtime/OvertimeForm.jsx`

- [ ] **Step 1: Create the form (drawer content)**

Create `frontend/src/app/overtime/OvertimeForm.jsx`:
```jsx
"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

const emptyLine = () => ({ user_id: "", start_time: "", end_time: "", reason: "" });

export default function OvertimeForm({ onSuccess }) {
  const { p } = useAppSettings();
  const [employees, setEmployees] = useState([]);
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [departement, setDepartement] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/members?limit=1000`)
      .then((r) => setEmployees(r.data || []))
      .catch(() => setEmployees([]));
  }, []);

  const setLine = (i, key, val) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    if (!date || lines.some((l) => !l.user_id || !l.start_time || !l.end_time)) {
      setError("Date and every worker row (worker, start, end) are required.");
      return;
    }
    setSaving(true);
    try {
      const toISO = (d, t) => new Date(`${d}T${t}:00`).toISOString();
      await fetchWithAuth(`${apiBaseUrl}/api/overtime`, {
        method: "POST",
        body: JSON.stringify({
          departement: departement || null,
          date,
          shift: shift || null,
          lines: lines.map((l) => ({
            user_id: l.user_id,
            start_time: toISO(date, l.start_time),
            end_time: toISO(date, l.end_time),
            reason: l.reason || null,
          })),
        }),
      });
      onSuccess?.();
    } catch (e) {
      setError(e?.error || "Failed to submit overtime.");
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: p.muted, marginBottom: 4, display: "block" };
  const input = { width: "100%", background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><span style={label}>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></div>
        <div><span style={label}>Shift</span>
          <input type="number" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="1" style={input} /></div>
      </div>
      <div><span style={label}>Department</span>
        <input value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="Production" style={input} /></div>

      <div className="flex items-center justify-between mt-1">
        <span style={{ ...label, marginBottom: 0 }}>Workers</span>
        <button onClick={addLine} className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
          style={{ background: p.inputBg, border: `1px solid ${p.border}`, color: p.accent }}>
          <Plus size={13} /> Add worker
        </button>
      </div>

      {lines.map((l, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 rounded-xl" style={{ border: `1px solid ${p.border}` }}>
          <select value={l.user_id} onChange={(e) => setLine(i, "user_id", e.target.value)} style={input}>
            <option value="">Select worker…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} {emp.nik ? `(${emp.nik})` : ""}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={l.start_time} onChange={(e) => setLine(i, "start_time", e.target.value)} style={input} />
            <input type="time" value={l.end_time} onChange={(e) => setLine(i, "end_time", e.target.value)} style={input} />
          </div>
          <div className="flex gap-2">
            <input value={l.reason} onChange={(e) => setLine(i, "reason", e.target.value)} placeholder="Reason (optional)" style={input} />
            {lines.length > 1 && (
              <button onClick={() => removeLine(i)} className="px-2 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-[12px]" style={{ color: "#e06666" }}>{error}</p>}

      <button onClick={submit} disabled={saving}
        className="mt-2 py-2.5 rounded-xl text-[13px] font-black disabled:opacity-60"
        style={{ background: p.primary, color: "#fff" }}>
        {saving ? "Submitting…" : "Submit Overtime"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/overtime/OvertimeForm.jsx
git commit -m "feat: overtime batch submit form"
```

---

### Task D2: Role-aware overtime page

**Files:**
- Modify (rewrite): `frontend/src/app/overtime/page.jsx`

- [ ] **Step 1: Replace the placeholder page**

Replace the entire contents of `frontend/src/app/overtime/page.jsx`:
```jsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Check, X, FileSpreadsheet, Clock } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import OvertimeForm from "./OvertimeForm";

const STATUS_COLOR = { pending: "#d6a23e", approved: "#3fa66a", rejected: "#e06666" };

export default function OvertimePage() {
  const { p } = useAppSettings();
  const [role, setRole] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const r = await fetchWithAuth(`${apiBaseUrl}/api/overtime${q}`);
      setRequests(r.data || []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/auth/me`).then((u) => setRole(u.roleuser)).catch(() => setRole(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try { await fetchWithAuth(`${apiBaseUrl}/api/overtime/${id}/approve`, { method: "PATCH" }); load(); }
    catch (e) { alert(e?.error || "Approve failed"); }
  };
  const reject = async (id) => {
    const reason = prompt("Reject reason:");
    if (!reason) return;
    try { await fetchWithAuth(`${apiBaseUrl}/api/overtime/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }); load(); }
    catch (e) { alert(e?.error || "Reject failed"); }
  };
  const exportExcel = () => {
    const month = new Date().toISOString().slice(0, 7);
    window.open(`${apiBaseUrl}/api/overtime/export/excel?month=${month}`, "_blank");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen" style={{ background: p.pageBg }}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>HR Management</p>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>Overtime</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: p.cardBg, border: `1px solid ${p.border}`, color: p.text }}>
                <FileSpreadsheet size={14} /> Export
              </button>
            )}
            <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-black"
              style={{ background: p.primary, color: "#fff" }}>
              <Plus size={14} /> New Overtime
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-5">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize"
              style={{
                background: statusFilter === s ? p.primary : p.cardBg,
                color: statusFilter === s ? "#fff" : p.muted,
                border: `1px solid ${p.border}`,
              }}>
              {s || "all"}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ color: p.muted }} className="text-sm">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: p.faint }}>
            <Clock size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No overtime requests.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-black" style={{ color: p.text }}>
                      {new Date(r.date).toISOString().slice(0, 10)}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: p.muted }}>
                      {r.departement || "—"} · {r.lines?.length || 0} worker(s)
                      {r.shift ? ` · shift ${r.shift}` : ""}
                    </span>
                    {isAdmin && r.submitter?.name && (
                      <span className="text-[11px]" style={{ color: p.faint }}>by {r.submitter.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
                      style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                    {isAdmin && r.status === "pending" && (
                      <>
                        <button onClick={() => approve(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#3fa66a" }}><Check size={14} /></button>
                        <button onClick={() => reject(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><X size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.lines?.map((l) => (
                    <span key={l.id} className="text-[11px] px-2 py-1 rounded-lg"
                      style={{ background: p.inputBg, color: p.muted }}>
                      {l.worker?.name || "?"} · {Number(l.hours)}h
                    </span>
                  ))}
                </div>
                {r.status === "rejected" && r.reject_reason && (
                  <p className="text-[11px] mt-2" style={{ color: "#e06666" }}>Rejected: {r.reject_reason}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Overtime" subtitle="Submit a batch for approval">
        <OvertimeForm onSuccess={() => { setDrawerOpen(false); load(); }} />
      </Drawer>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/overtime/page.jsx
git commit -m "feat: role-aware overtime page (submit + admin approve/reject/export)"
```

---

### Task D3: Manual UI verification

**Files:** none

- [ ] **Step 1: Start both servers**

```bash
cd backend && PORT=3041 node src/index.js   # terminal 1
cd frontend && npm run dev                   # terminal 2 (http://localhost:3040)
```

- [ ] **Step 2: Verify as admin**

Log in as the admin account. Visit `http://localhost:3040/overtime`. Expected:
- "New Overtime" + "Export" buttons both visible.
- Submit a batch with 2 workers → appears as `pending`.
- Approve it → badge turns `approved`, approve/reject buttons disappear.
- Submit another, reject with reason → badge `rejected`, reason shown.
- Export → downloads `lembur_YYYY-MM.xlsx` containing only approved rows.

- [ ] **Step 3: Verify supervisor scoping (if a supervisor account exists)**

Create one if needed:
```bash
psql "$DATABASE_URL" -c "UPDATE users SET role='supervisor' WHERE username='<some-username>';"
```
Log in as that user. Expected: no "Export" button; sees only own submitted requests; no approve/reject buttons.

- [ ] **Step 4: Build check**

Run: `cd frontend && npm run build`
Expected: build succeeds, no errors in `/overtime`.

---

## Testing Summary

- **Backend unit:** `node --test` runs `tests/auth.middleware.test.js` (5) + `tests/overtime.test.js` (3 — hours calc).
- **Backend manual:** auth smoke (A5), overtime API round-trip (C5 Step 3).
- **Frontend manual:** admin + supervisor flows (D3), build check.

Run all backend tests: `cd backend && npm test`

---

## Self-Review

- **Spec coverage:** Part A (middleware + requireRole + cookie-parser + refresh fix + `/auth/me`), Part B (drop legacy, request/line tables, prisma), Part C (POST/GET/GET:id/approve/reject/PUT/DELETE/export — all 8 spec endpoints), Part D (supervisor submit, admin approve/reject/export, role from JWT). All spec sections mapped.
- **Role strings:** verified live — `"admin"` exists, `"supervisor"` to be assigned. Guards use `roleuser` JWT key (not `role`). Consistent across middleware, routes, frontend.
- **Naming consistency:** `computeHours`, `isAdmin`, `loadEditable`, `overtime_request`/`overtime_line`, relation names (`ot_submitter`/`ot_approver`/`ot_worker`) consistent between schema (B2) and route usage (C1–C5).
- **Ordering trap handled:** `/export/excel` placed above `/:id` (C5 Step 2); public leaderboard mount before protected (A4 Step 2).
- **Deferred (out of scope):** legal multiplier (NULL column reserved), worker accounts, payroll API.

## Out of Scope (later modules)

Legal overtime multiplier calc (needs Shift module day-type data), worker self-service, payroll API push, shift scheduling, leave, contracts.
