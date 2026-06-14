const { test, after } = require("node:test");
const assert = require("node:assert");

const prisma = require("../libs/prisma");

// ─── Expected schema ─────────────────────────────────────────────────────────
// One entry per table that schema.prisma declares. Only columns the app code
// actually relies on are listed; trivial audit columns (created_at/updated_at)
// are checked once via a generic helper. Adding rows here when you add a model
// is the ONLY drift-protection we have, so keep it current.

const EXPECTED = {
  users: [
    "id", "nik", "name", "role", "access", "email", "departement", "section",
    "status", "worker_stats", "join_date", "username", "password", "hash",
    "link_image", "deletedAt", "shift_id",
  ],
  performance: ["id", "user_id", "quarter", "status", "description"],
  attendance: ["id", "user_id", "device_uid", "punch_time", "punch_type"],
  shift: ["id", "name", "start_time", "end_time", "active"],
  holiday: ["id", "date", "name"],
  overtime_request: [
    "id", "submitted_by", "departement", "date", "shift", "status",
    "approved_by", "approved_at", "reject_reason",
  ],
  overtime_line: [
    "id", "request_id", "user_id", "start_time", "end_time", "hours",
    "reason", "multiplier",
  ],
  leave_request: [
    "id", "user_id", "submitted_by", "leave_type", "start_date", "end_date",
    "days", "reason", "status", "approved_by", "approved_at", "reject_reason",
  ],
  leave_balance: [
    "id", "user_id", "year", "leave_type", "entitled", "used",
  ],
};

async function columnsOf(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
  return new Set(rows.map((r) => r.column_name));
}

test("verify-schema: every model in schema.prisma exists in DB", async () => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'`,
  );
  const have = new Set(rows.map((r) => r.table_name));
  for (const table of Object.keys(EXPECTED)) {
    assert.ok(
      have.has(table),
      `missing table "${table}" — did a migration fail to apply?`,
    );
  }
});

test("verify-schema: every important column exists", async () => {
  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    const have = await columnsOf(table);
    for (const col of expectedCols) {
      assert.ok(
        have.has(col),
        `${table}.${col} missing — schema drift between schema.prisma and DB`,
      );
    }
  }
});

test("verify-schema: no leftover legacy overtime tables", async () => {
  // 20260607_overtime_module dropped these. If they reappear, init.sql or a
  // rogue migration is recreating them.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('overtime', 'overtime_permit', 'overtime_detail')`,
  );
  assert.deepStrictEqual(
    rows.map((r) => r.table_name).sort(),
    [],
    "legacy overtime tables resurrected — check init.sql",
  );
});

after(async () => {
  await prisma.$disconnect();
});
