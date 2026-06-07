const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

function computeHours(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!(e > s)) throw new Error("end_time must be after start_time");
  return Math.round(((e - s) / 3600000) * 100) / 100;
}

function isAdmin(req) {
  return req.user?.roleuser === "admin";
}

// POST / — supervisor or admin creates a batch (status=pending)
router.post("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { departement, date, shift, lines } = req.body;
    if (!date || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "date and at least one line required" });
    }
    const lineData = lines.map((l) => ({
      user_id: l.user_id,
      start_time: new Date(l.start_time),
      end_time: new Date(l.end_time),
      hours: computeHours(l.start_time, l.end_time),
      reason: l.reason || null,
    }));
    const created = await prisma.overtime_request.create({
      data: {
        submitted_by: req.user.id,
        departement: departement || req.user.depart || null,
        date: new Date(date),
        shift: shift != null ? Number(shift) : null,
        status: "pending",
        lines: { create: lineData },
      },
      include: { lines: true },
    });
    res.status(201).json({ message: "Overtime request created", data: created });
  } catch (error) {
    if (error.message.includes("end_time")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET / — list. Supervisor sees own; admin sees all. Filters: status, date, dept.
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { status, date, departement } = req.query;
    const where = {
      ...(isAdmin(req) ? {} : { submitted_by: req.user.id }),
      ...(status && { status }),
      ...(date && { date: new Date(date) }),
      ...(departement && { departement: { contains: departement, mode: "insensitive" } }),
    };
    const data = await prisma.overtime_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /:id — one request. Supervisor only if owner; admin any.
router.get("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await prisma.overtime_request.findUnique({
      where: { id: req.params.id },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isAdmin(req) && r.submitted_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.status(200).json({ data: r });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
module.exports.computeHours = computeHours;
