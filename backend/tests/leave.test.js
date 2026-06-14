const { test } = require("node:test");
const assert = require("node:assert");
const { computeLeaveDays, LEAVE_TYPES } = require("../src/routes/leave");
const { countWorkingDays } = require("../src/lib/workingDays");

// --- Pure helper checks (no DB) ---

test("LEAVE_TYPES exposes the canonical set", () => {
  assert.deepStrictEqual(
    LEAVE_TYPES,
    ["annual", "sick", "personal", "maternity", "unpaid"],
  );
});

test("countWorkingDays: Mon-Fri inclusive = 5", () => {
  // 2026-03-02 (Mon) .. 2026-03-06 (Fri) inclusive — exclusive end = 03-07
  const start = new Date("2026-03-02T00:00:00");
  const end = new Date("2026-03-07T00:00:00");
  assert.strictEqual(countWorkingDays(start, end, new Set()), 5);
});

test("countWorkingDays: spanning a weekend skips Sat+Sun", () => {
  // 2026-03-02 (Mon) .. 2026-03-09 (Mon) inclusive — exclusive end = 03-10
  const start = new Date("2026-03-02T00:00:00");
  const end = new Date("2026-03-10T00:00:00");
  assert.strictEqual(countWorkingDays(start, end, new Set()), 6); // Mon-Fri + next Mon
});

test("countWorkingDays: weekend-only span = 0", () => {
  // 2026-03-07 (Sat) .. 2026-03-08 (Sun) inclusive — exclusive end = 03-09
  const start = new Date("2026-03-07T00:00:00");
  const end = new Date("2026-03-09T00:00:00");
  assert.strictEqual(countWorkingDays(start, end, new Set()), 0);
});

test("countWorkingDays: holiday on a weekday is excluded", () => {
  // Same Mon-Fri as first test, but mark Wed as holiday
  const start = new Date("2026-03-02T00:00:00");
  const end = new Date("2026-03-07T00:00:00");
  const holidays = new Set(["2026-03-04"]);
  assert.strictEqual(countWorkingDays(start, end, holidays), 4);
});

// --- DB-touching helper (uses live holiday table) ---

test("computeLeaveDays: 5 working days for a clean Mon-Fri week", async () => {
  // March 2026 has no holidays in our seeded DB
  const days = await computeLeaveDays("2026-03-02", "2026-03-06");
  assert.strictEqual(days, 5);
});

test("computeLeaveDays: single weekday = 1", async () => {
  const days = await computeLeaveDays("2026-03-03", "2026-03-03");
  assert.strictEqual(days, 1);
});

test("computeLeaveDays: weekend-only range = 0", async () => {
  const days = await computeLeaveDays("2026-03-07", "2026-03-08");
  assert.strictEqual(days, 0);
});

test("computeLeaveDays: throws if end_date < start_date", async () => {
  await assert.rejects(
    () => computeLeaveDays("2026-03-10", "2026-03-05"),
    /end_date must be on or after start_date/,
  );
});
