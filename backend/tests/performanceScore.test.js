const { test } = require("node:test");
const assert = require("node:assert");
const {
  ATTENDANCE_WEIGHT,
  PERFORMANCE_WEIGHT,
  PERFORMANCE_RATING_MAP,
  PERFORMANCE_RATING_PCT_MAP,
  computeCombinedScore,
  computeCombinedScoreFromPct,
  ratingForStatus,
  ratingPctForStatus,
} = require("../src/lib/performanceScore");

test("weights sum to 1.0 (60% attendance / 40% performance)", () => {
  assert.strictEqual(ATTENDANCE_WEIGHT, 0.6);
  assert.strictEqual(PERFORMANCE_WEIGHT, 0.4);
  assert.strictEqual(ATTENDANCE_WEIGHT + PERFORMANCE_WEIGHT, 1.0);
});

test("computeCombinedScore: perfect attendance + best perf = 100", () => {
  assert.strictEqual(computeCombinedScore(1.0, 1.0), 100);
});

test("computeCombinedScore: zero attendance + zero perf = 0", () => {
  assert.strictEqual(computeCombinedScore(0, 0), 0);
});

test("computeCombinedScore: spec example 0.95 attendance × 1.0 perf = 97", () => {
  // From docs/superpowers/specs/2026-06-05-ui-ux-redesign-v2.md
  assert.strictEqual(computeCombinedScore(0.95, 1.0), 97);
});

test("computeCombinedScore: 100% attendance + worst perf = 70", () => {
  // 1.0 * 0.6 + 0.25 * 0.4 = 0.7 → 70
  assert.strictEqual(computeCombinedScore(1.0, 0.25), 70);
});

test("computeCombinedScore: 0% attendance + best perf = 40", () => {
  // 0 * 0.6 + 1.0 * 0.4 = 0.4 → 40
  assert.strictEqual(computeCombinedScore(0, 1.0), 40);
});

test("computeCombinedScore: rounds to nearest integer", () => {
  // 0.333 * 0.6 + 0.5 * 0.4 = 0.1998 + 0.2 = 0.3998 → round → 40
  assert.strictEqual(computeCombinedScore(0.333, 0.5), 40);
});

test("computeCombinedScore: NaN/undefined inputs treated as 0", () => {
  assert.strictEqual(computeCombinedScore(NaN, 1.0), 40);
  assert.strictEqual(computeCombinedScore(undefined, 1.0), 40);
  assert.strictEqual(computeCombinedScore(0.5, NaN), 30);
});

test("computeCombinedScoreFromPct: matches ratio form for same input", () => {
  // 95% attendance + 100% perf should equal computeCombinedScore(0.95, 1.0)
  assert.strictEqual(computeCombinedScoreFromPct(95, 100), 97);
  assert.strictEqual(computeCombinedScoreFromPct(100, 100), 100);
  assert.strictEqual(computeCombinedScoreFromPct(0, 0), 0);
  assert.strictEqual(computeCombinedScoreFromPct(100, 25), 70);
});

test("computeCombinedScoreFromPct: parity with computeCombinedScore across grid", () => {
  for (const a of [0, 25, 50, 75, 100]) {
    for (const p of [0, 25, 50, 75, 100]) {
      const fromPct = computeCombinedScoreFromPct(a, p);
      const fromRatio = computeCombinedScore(a / 100, p / 100);
      assert.strictEqual(fromPct, fromRatio, `mismatch at attendance=${a}% perf=${p}%`);
    }
  }
});

test("ratingForStatus: maps known statuses (case-insensitive)", () => {
  assert.strictEqual(ratingForStatus("best"), 1.0);
  assert.strictEqual(ratingForStatus("BEST"), 1.0);
  assert.strictEqual(ratingForStatus("Good"), 0.75);
  assert.strictEqual(ratingForStatus("average"), 0.5);
  assert.strictEqual(ratingForStatus("worst"), 0.25);
});

test("ratingForStatus: unknown / null / empty returns 0", () => {
  assert.strictEqual(ratingForStatus(null), 0);
  assert.strictEqual(ratingForStatus(undefined), 0);
  assert.strictEqual(ratingForStatus(""), 0);
  assert.strictEqual(ratingForStatus("excellent"), 0);
});

test("ratingPctForStatus: percentage form (0..100)", () => {
  assert.strictEqual(ratingPctForStatus("best"), 100);
  assert.strictEqual(ratingPctForStatus("good"), 75);
  assert.strictEqual(ratingPctForStatus("average"), 50);
  assert.strictEqual(ratingPctForStatus("worst"), 25);
  assert.strictEqual(ratingPctForStatus(null), 0);
});

test("rating maps: pct map is exactly 100× ratio map", () => {
  for (const k of Object.keys(PERFORMANCE_RATING_MAP)) {
    assert.strictEqual(PERFORMANCE_RATING_PCT_MAP[k], PERFORMANCE_RATING_MAP[k] * 100);
  }
});
