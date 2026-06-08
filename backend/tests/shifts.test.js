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

const adminCookie = `accessToken=${jwt.sign({ id: "admin-test", roleuser: "admin" }, process.env.JWT_SECRET)}`;

test("create → list → delete-blocked-when-assigned → unassign → delete", async () => {
  const create = await request(app).post("/api/shifts").set("Cookie", adminCookie)
    .send({ name: "Test Shift", start_time: "07:00", end_time: "15:00" });
  assert.strictEqual(create.status, 201);
  const shiftId = create.body.data.id;

  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: shiftId } });

  const blocked = await request(app).delete(`/api/shifts/${shiftId}`).set("Cookie", adminCookie);
  assert.strictEqual(blocked.status, 409);

  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: null } });
  const ok = await request(app).delete(`/api/shifts/${shiftId}`).set("Cookie", adminCookie);
  assert.strictEqual(ok.status, 200);
});

test("non-admin cannot create (403)", async () => {
  const supCookie = `accessToken=${jwt.sign({ id: "sup", roleuser: "supervisor" }, process.env.JWT_SECRET)}`;
  const res = await request(app).post("/api/shifts").set("Cookie", supCookie)
    .send({ name: "X", start_time: "07:00", end_time: "15:00" });
  assert.strictEqual(res.status, 403);
});
