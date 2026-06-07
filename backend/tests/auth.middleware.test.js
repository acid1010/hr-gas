const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const { authMiddleware, requireRole } = require("../src/middleware/auth");

function appWith(handlerGuards) {
  const app = express();
  app.use(cookieParser());
  app.get("/p", ...handlerGuards, (req, res) => res.json({ user: req.user }));
  return app;
}
function tokenFor(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "20m" });
}

test("401 when no token", async () => {
  const res = await request(appWith([authMiddleware])).get("/p");
  assert.strictEqual(res.status, 401);
});

test("401 when token invalid", async () => {
  const res = await request(appWith([authMiddleware]))
    .get("/p").set("Cookie", "accessToken=garbage");
  assert.strictEqual(res.status, 401);
});

test("attaches req.user when valid", async () => {
  const t = tokenFor({ id: "u1", username: "bob", roleuser: "admin" });
  const res = await request(appWith([authMiddleware]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.roleuser, "admin");
});

test("requireRole 403 for wrong role", async () => {
  const t = tokenFor({ id: "u2", roleuser: "supervisor" });
  const res = await request(appWith([authMiddleware, requireRole("admin")]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 403);
});

test("requireRole passes for allowed role", async () => {
  const t = tokenFor({ id: "u3", roleuser: "admin" });
  const res = await request(appWith([authMiddleware, requireRole("admin", "supervisor")]))
    .get("/p").set("Cookie", `accessToken=${t}`);
  assert.strictEqual(res.status, 200);
});
