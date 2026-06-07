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
