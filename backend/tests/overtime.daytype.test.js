const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const prisma = require("../libs/prisma");
const { authMiddleware } = require("../src/middleware/auth");
const overtimeRoutes = require("../src/routes/overtime");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/overtime", authMiddleware, overtimeRoutes);

// submitted_by is an FK to users.id, so the token id must be a real user UUID
async function adminCookie() {
  const u = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  return `accessToken=${jwt.sign({ id: u.id, roleuser: "admin" }, process.env.JWT_SECRET)}`;
}

test("list returns day_type rest_day for a Saturday OT", async () => {
  const admin = await adminCookie();
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  const create = await request(app).post("/api/overtime").set("Cookie", admin).send({
    departement: "Production", date: "2026-06-13", // Saturday
    lines: [{ user_id: worker.id, start_time: "2026-06-13T18:00:00", end_time: "2026-06-13T20:00:00" }],
  });
  const id = create.body.data.id;
  try {
    const list = await request(app).get("/api/overtime?status=pending").set("Cookie", admin);
    const found = list.body.data.find((r) => r.id === id);
    assert.strictEqual(found.day_type, "rest_day");

    const detail = await request(app).get(`/api/overtime/${id}`).set("Cookie", admin);
    assert.strictEqual(detail.body.data.day_type, "rest_day");
  } finally {
    await prisma.overtime_request.delete({ where: { id } }).catch(() => {});
  }
});

test("holiday on the OT date classifies as holiday", async () => {
  const admin = await adminCookie();
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  // 2026-06-10 is a Wednesday (workday) unless a holiday exists
  const holiday = await prisma.holiday.create({ data: { date: new Date("2026-06-10"), name: "TestHol" } });
  const create = await request(app).post("/api/overtime").set("Cookie", admin).send({
    departement: "Production", date: "2026-06-10",
    lines: [{ user_id: worker.id, start_time: "2026-06-10T18:00:00", end_time: "2026-06-10T20:00:00" }],
  });
  const id = create.body.data.id;
  try {
    const detail = await request(app).get(`/api/overtime/${id}`).set("Cookie", admin);
    assert.strictEqual(detail.body.data.day_type, "holiday");
  } finally {
    await prisma.overtime_request.delete({ where: { id } }).catch(() => {});
    await prisma.holiday.delete({ where: { id: holiday.id } }).catch(() => {});
  }
});
