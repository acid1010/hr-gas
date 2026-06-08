const { test } = require("node:test");
const assert = require("node:assert");
const { isWorkingDay, countWorkingDays } = require("../src/lib/workingDays");

// 2026-06-08 is a Monday; 2026-06-13 Sat; 2026-06-14 Sun
test("isWorkingDay: Monday true", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-08"), new Set()), true);
});
test("isWorkingDay: Friday true", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-12"), new Set()), true);
});
test("isWorkingDay: Saturday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-13"), new Set()), false);
});
test("isWorkingDay: Sunday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-14"), new Set()), false);
});
test("isWorkingDay: holiday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-08"), new Set(["2026-06-08"])), false);
});
test("countWorkingDays: June 2026 has 22 weekdays", () => {
  const n = countWorkingDays(new Date(2026, 5, 1), new Date(2026, 6, 1), new Set());
  assert.strictEqual(n, 22);
});
test("countWorkingDays: subtract one holiday", () => {
  const n = countWorkingDays(new Date(2026, 5, 1), new Date(2026, 6, 1), new Set(["2026-06-08"]));
  assert.strictEqual(n, 21);
});
