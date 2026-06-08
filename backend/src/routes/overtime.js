const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");
const ExcelJS = require("exceljs");
const { classifyDay, getHolidaySet } = require("../lib/workingDays");

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
    const requests = await prisma.overtime_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    let data = requests;
    if (requests.length > 0) {
      const times = requests.map((r) => new Date(r.date).getTime());
      const min = new Date(Math.min(...times));
      const max = new Date(Math.max(...times));
      const spanEnd = new Date(max);
      spanEnd.setDate(spanEnd.getDate() + 1); // inclusive of max date
      const holidays = await getHolidaySet(prisma, min, spanEnd);
      data = requests.map((r) => ({ ...r, day_type: classifyDay(new Date(r.date), holidays) }));
    }
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /export/excel?month=YYYY-MM — admin only. Approved overtime for payroll.
router.get("/export/excel", requireRole("admin"), async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const requests = await prisma.overtime_request.findMany({
      where: { status: "approved", date: { gte: start, lt: end } },
      include: { lines: { include: { worker: { select: { name: true, nik: true } } } } },
      orderBy: { date: "asc" },
    });

    const holidays = await getHolidaySet(prisma, start, end);

    const rows = [];
    for (const r of requests) {
      for (const l of r.lines) {
        rows.push({
          NIK: l.worker?.nik ? String(l.worker.nik) : "",
          Nama: l.worker?.name || "",
          Departemen: r.departement || "",
          Tanggal: new Date(r.date).toISOString().slice(0, 10),
          "Tipe Hari": classifyDay(new Date(r.date), holidays),
          "Jam Mulai": new Date(l.start_time).toISOString().slice(11, 16),
          "Jam Selesai": new Date(l.end_time).toISOString().slice(11, 16),
          "Total Jam": Number(l.hours),
          Pengali: l.multiplier != null ? Number(l.multiplier) : "",
          Keterangan: l.reason || "",
        });
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Lembur ${month}`);
    ws.columns = [
      { width: 12 }, { width: 28 }, { width: 16 }, { width: 12 }, { width: 12 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 30 },
    ];
    if (rows.length > 0) ws.addRow(Object.keys(rows[0]));
    rows.forEach(r => ws.addRow(Object.values(r)));
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="lembur_${month}.xlsx"`);
    res.status(200).send(buf);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
    const d = new Date(r.date);
    const dEnd = new Date(d);
    dEnd.setDate(dEnd.getDate() + 1);
    const holidays = await getHolidaySet(prisma, d, dEnd);
    res.status(200).json({ data: { ...r, day_type: classifyDay(d, holidays) } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /:id/approve — admin only
router.patch("/:id/approve", requireRole("admin"), async (req, res) => {
  try {
    const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot approve a ${r.status} request` });
    }
    const updated = await prisma.overtime_request.update({
      where: { id: req.params.id },
      data: { status: "approved", approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
    });
    res.status(200).json({ message: "Approved", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /:id/reject — admin only, requires reason
router.patch("/:id/reject", requireRole("admin"), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "reject reason required" });
    }
    const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot reject a ${r.status} request` });
    }
    const updated = await prisma.overtime_request.update({
      where: { id: req.params.id },
      data: { status: "rejected", reject_reason: reason.trim(), approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
    });
    res.status(200).json({ message: "Rejected", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// shared guard: load request, enforce owner/admin + pending
async function loadEditable(req, res) {
  const r = await prisma.overtime_request.findUnique({ where: { id: req.params.id } });
  if (!r) { res.status(404).json({ error: "Not found" }); return null; }
  if (!isAdmin(req) && r.submitted_by !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return null;
  }
  if (r.status !== "pending") {
    res.status(409).json({ error: `Cannot modify a ${r.status} request` }); return null;
  }
  return r;
}

// PUT /:id — replace lines + header fields (pending only)
router.put("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    const { departement, date, shift, lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "at least one line required" });
    }
    const lineData = lines.map((l) => ({
      user_id: l.user_id,
      start_time: new Date(l.start_time),
      end_time: new Date(l.end_time),
      hours: computeHours(l.start_time, l.end_time),
      reason: l.reason || null,
    }));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.overtime_line.deleteMany({ where: { request_id: r.id } });
      return tx.overtime_request.update({
        where: { id: r.id },
        data: {
          departement: departement ?? r.departement,
          date: date ? new Date(date) : r.date,
          shift: shift != null ? Number(shift) : r.shift,
          updated_at: new Date(),
          lines: { create: lineData },
        },
        include: { lines: true },
      });
    });
    res.status(200).json({ message: "Updated", data: updated });
  } catch (error) {
    if (error.message.includes("end_time")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — pending only, owner/admin (lines cascade)
router.delete("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    await prisma.overtime_request.delete({ where: { id: r.id } });
    res.status(200).json({ message: "Deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
module.exports.computeHours = computeHours;
