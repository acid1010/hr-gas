const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const prisma = require("../libs/prisma");
const { authMiddleware } = require("../src/middleware/auth");
const shiftsRoutes = require("../src/routes/shifts");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/shifts", authMiddleware, shiftsRoutes);

const adminCookie = `accessToken=${jwt.sign({ id: "admin-cov", roleuser: "admin" }, process.env.JWT_SECRET)}`;
const supCookie = `accessToken=${jwt.sign({ id: "sup-cov", roleuser: "supervisor" }, process.env.JWT_SECRET)}`;

test("coverage: assigned worker appears in matrix[shift][dept]; supervisor can read", async () => {
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true, departement: true, shift_id: true } });
  const created = await request(app).post("/api/shifts").set("Cookie", adminCookie)
    .send({ name: "CovTest", start_time: "07:00", end_time: "15:00" });
  const shiftId = created.body.data.id;
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: shiftId } });

  try {
    const res = await request(app).get("/api/shifts/coverage").set("Cookie", supCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.shifts));
    assert.ok(Array.isArray(res.body.departments));

    const dept = (worker.departement && worker.departement.trim()) ? worker.departement : "—";
    const bucket = res.body.matrix[shiftId];
    assert.ok(bucket, "shift bucket present in matrix");
    const ids = (bucket[dept] || []).map((w) => w.id);
    assert.ok(ids.includes(worker.id), "worker listed under its shift × dept");
    assert.ok(res.body.totals[shiftId] >= 1, "shift total counts the worker");
    assert.ok(res.body.departments.includes(dept), "departments includes worker dept");
  } finally {
    await prisma.users.update({ where: { id: worker.id }, data: { shift_id: worker.shift_id } });
    await prisma.shift.delete({ where: { id: shiftId } }).catch(() => {});
  }
});

test("coverage: an unassigned worker appears under 'unassigned'", async () => {
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true, shift_id: true } });
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: null } });
  try {
    const res = await request(app).get("/api/shifts/coverage").set("Cookie", adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.matrix.unassigned, "unassigned bucket present");
    assert.ok(res.body.totals.unassigned >= 1, "unassigned total >= 1");
  } finally {
    await prisma.users.update({ where: { id: worker.id }, data: { shift_id: worker.shift_id } });
  }
});

test("coverage: no auth → 401", async () => {
  const res = await request(app).get("/api/shifts/coverage");
  assert.strictEqual(res.status, 401);
});
