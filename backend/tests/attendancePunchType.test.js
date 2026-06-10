const { test } = require("node:test");
const assert = require("node:assert");
const {
  classifyByFallback,
  classifyByShift,
  classifyPunchType,
  normalizeDevicePunchType,
} = require("../src/lib/attendancePunchType");

function createPrismaMock({ user = null, firstPunch = null } = {}) {
  return {
    users: {
      findFirst: async () => user,
    },
    attendance: {
      findFirst: async () => firstPunch,
    },
  };
}

test("classifyPunchType returns masuk for first daily punch", async () => {
  const prisma = createPrismaMock();

  const type = await classifyPunchType(prisma, "250600578", new Date("2026-06-10T08:00:00+07:00"));

  assert.strictEqual(type, 0);
});

test("normalizeDevicePunchType accepts only explicit masuk or keluar", () => {
  assert.strictEqual(normalizeDevicePunchType(0), 0);
  assert.strictEqual(normalizeDevicePunchType("1"), 1);
  assert.strictEqual(normalizeDevicePunchType(2), null);
  assert.strictEqual(normalizeDevicePunchType(undefined), null);
});

test("classifyPunchType uses explicit device keluar before fallback", async () => {
  const prisma = createPrismaMock();

  const type = await classifyPunchType(prisma, "250600578", new Date("2026-06-10T08:00:00+07:00"), 1);

  assert.strictEqual(type, 1);
});

test("classifyByFallback keeps duplicate morning punches as masuk", () => {
  const firstPunch = { punch_time: new Date("2026-06-10T08:00:00+07:00"), punch_type: 0 };

  const type = classifyByFallback(new Date("2026-06-10T08:15:00+07:00"), firstPunch);

  assert.strictEqual(type, 0);
});

test("classifyByFallback returns keluar after noon when no shift exists", () => {
  const firstPunch = { punch_time: new Date("2026-06-10T08:00:00+07:00"), punch_type: 0 };

  const type = classifyByFallback(new Date("2026-06-10T17:12:00+07:00"), firstPunch);

  assert.strictEqual(type, 1);
});

test("classifyByShift returns masuk before shift midpoint", () => {
  const shift = {
    start_time: new Date("1970-01-01T08:00:00Z"),
    end_time: new Date("1970-01-01T17:00:00Z"),
  };

  const type = classifyByShift(new Date(2026, 5, 10, 10, 0), shift);

  assert.strictEqual(type, 0);
});

test("classifyByShift returns keluar after shift midpoint", () => {
  const shift = {
    start_time: new Date("1970-01-01T08:00:00Z"),
    end_time: new Date("1970-01-01T17:00:00Z"),
  };

  const type = classifyByShift(new Date(2026, 5, 10, 17, 12), shift);

  assert.strictEqual(type, 1);
});

test("classifyPunchType prefers assigned shift over fallback", async () => {
  const prisma = createPrismaMock({
    user: {
      shift: {
        start_time: new Date("1970-01-01T08:00:00Z"),
        end_time: new Date("1970-01-01T17:00:00Z"),
      },
    },
  });

  const type = await classifyPunchType(prisma, "250600578", new Date(2026, 5, 10, 17, 12));

  assert.strictEqual(type, 1);
});
