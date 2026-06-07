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

module.exports = router;
module.exports.computeHours = computeHours;
