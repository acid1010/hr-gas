const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

// times come in as 'HH:MM' strings; store on a fixed epoch date for TIME column.
// Force UTC (trailing Z) so the stored time matches the input — the frontend
// reads it back with toISOString (also UTC). Without Z it parses as local and
// shifts by the server's tz offset.
function toTime(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

// GET / — list with assigned worker count (admin + supervisor)
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { name: "asc" } });
    const counts = await prisma.users.groupBy({
      by: ["shift_id"],
      where: { deletedAt: null, shift_id: { not: null } },
      _count: { _all: true },
    });
    const countMap = {};
    for (const c of counts) countMap[c.shift_id] = c._count._all;
    const data = shifts.map((s) => ({ ...s, worker_count: countMap[s.id] || 0 }));
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST / — create (admin)
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { name, start_time, end_time } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: "name, start_time, end_time required" });
    }
    const created = await prisma.shift.create({
      data: { name, start_time: toTime(start_time), end_time: toTime(end_time) },
    });
    res.status(201).json({ message: "Shift created", data: created });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PUT /:id — update (admin)
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { name, start_time, end_time, active } = req.body;
    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name }),
        ...(start_time != null && { start_time: toTime(start_time) }),
        ...(end_time != null && { end_time: toTime(end_time) }),
        ...(active != null && { active }),
        updated_at: new Date(),
      },
    });
    res.status(200).json({ message: "Shift updated", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — admin, blocked if workers assigned
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const assigned = await prisma.users.count({ where: { shift_id: req.params.id, deletedAt: null } });
    if (assigned > 0) {
      return res.status(409).json({ error: `Cannot delete: ${assigned} worker(s) assigned` });
    }
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Shift deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /coverage — Shifts × Departments worker matrix (admin + supervisor)
router.get("/coverage", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, start_time: true, end_time: true },
    });
    const users = await prisma.users.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nik: true, departement: true, shift_id: true },
    });

    const DEPT_FALLBACK = "—";
    const deptSet = new Set();
    const matrix = {};
    const totals = {};

    for (const u of users) {
      const bucket = u.shift_id ? u.shift_id : "unassigned";
      const dept = u.departement && u.departement.trim() ? u.departement : DEPT_FALLBACK;
      deptSet.add(dept);
      if (!matrix[bucket]) matrix[bucket] = {};
      if (!matrix[bucket][dept]) matrix[bucket][dept] = [];
      matrix[bucket][dept].push({ id: u.id, name: u.name, nik: u.nik ? String(u.nik) : null });
      totals[bucket] = (totals[bucket] || 0) + 1;
    }

    const departments = [...deptSet].sort((a, b) => {
      if (a === DEPT_FALLBACK) return 1;
      if (b === DEPT_FALLBACK) return -1;
      return a.localeCompare(b);
    });

    res.status(200).json({ shifts, departments, matrix, totals });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
