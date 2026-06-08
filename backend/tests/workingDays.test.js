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

const { classifyDay } = require("../src/lib/workingDays");

test("classifyDay: weekday → workday", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-08"), new Set()), "workday"); // Mon
});
test("classifyDay: Saturday → rest_day", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-13"), new Set()), "rest_day");
});
test("classifyDay: Sunday → rest_day", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-14"), new Set()), "rest_day");
});
test("classifyDay: date in holiday set → holiday", () => {
  assert.strictEqual(classifyDay(new Date("2026-08-17"), new Set(["2026-08-17"])), "holiday");
});
test("classifyDay: holiday on a weekday wins over workday", () => {
  // 2026-08-17 is a Monday
  assert.strictEqual(classifyDay(new Date("2026-08-17"), new Set(["2026-08-17"])), "holiday");
});
test("classifyDay: holiday on a weekend still holiday", () => {
  // 2026-06-13 is a Saturday
  assert.strictEqual(classifyDay(new Date("2026-06-13"), new Set(["2026-06-13"])), "holiday");
});
