const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");
const ExcelJS = require("exceljs");
const { countWorkingDays, getHolidaySet } = require("../lib/workingDays");

const LEAVE_TYPES = ["annual", "sick", "personal", "maternity", "unpaid"];

function isAdmin(req) {
  return req.user?.roleuser === "admin";
}

// Compute working-days in [start, end] inclusive, excluding Sat/Sun + holidays.
async function computeLeaveDays(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (e < s) throw new Error("end_date must be on or after start_date");
  const exclusiveEnd = new Date(e);
  exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
  const holidays = await getHolidaySet(prisma, s, exclusiveEnd);
  return countWorkingDays(s, exclusiveEnd, holidays);
}

// POST / — create leave request (status=pending)
// Body: { user_id?, leave_type, start_date, end_date, reason? }
// Supervisors can submit for self or anyone in their dept; admins for anyone.
router.post("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { user_id, leave_type, start_date, end_date, reason } = req.body;
    if (!leave_type || !LEAVE_TYPES.includes(leave_type)) {
      return res.status(400).json({ error: `leave_type must be one of: ${LEAVE_TYPES.join(", ")}` });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: "start_date and end_date required" });
    }
    const targetUserId = user_id || req.user.id;
    // Supervisors can only submit for themselves (dept-scoped self-submission for now;
    // cross-user leave entry is admin-only to mirror overtime's submit-for-others pattern).
    if (!isAdmin(req) && targetUserId !== req.user.id) {
      return res.status(403).json({ error: "Supervisors can only submit leave for themselves" });
    }
    const days = await computeLeaveDays(start_date, end_date);
    if (days <= 0) {
      return res.status(400).json({ error: "leave range contains zero working days" });
    }
    const created = await prisma.leave_request.create({
      data: {
        user_id: targetUserId,
        submitted_by: req.user.id,
        leave_type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        days,
        reason: reason?.trim() || null,
        status: "pending",
      },
    });
    res.status(201).json({ message: "Leave request created", data: created });
  } catch (error) {
    if (error.message.includes("end_date")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET / — list. Supervisor sees own; admin sees all.
// Filters: status, leave_type, user_id, from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const { status, leave_type, user_id, from, to } = req.query;
    const where = {
      ...(isAdmin(req) ? {} : { OR: [{ submitted_by: req.user.id }, { user_id: req.user.id }] }),
      ...(status && { status }),
      ...(leave_type && { leave_type }),
      ...(user_id && { user_id }),
      ...((from || to) && {
        start_date: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };
    const data = await prisma.leave_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        taker: { select: { name: true, nik: true, departement: true } },
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

// GET /balance/:user_id?year=YYYY — current-year balance per leave_type
router.get("/balance/:user_id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const userId = req.params.user_id;
    if (!isAdmin(req) && userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const balances = await prisma.leave_balance.findMany({
      where: { user_id: userId, year },
      orderBy: { leave_type: "asc" },
    });
    res.status(200).json({ data: balances, year });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /export/excel?month=YYYY-MM — admin only
router.get("/export/excel", requireRole("admin"), async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const requests = await prisma.leave_request.findMany({
      where: { status: "approved", start_date: { gte: start, lt: end } },
      include: { taker: { select: { name: true, nik: true, departement: true } } },
      orderBy: { start_date: "asc" },
    });

    const rows = requests.map((r) => ({
      NIK: r.taker?.nik ? String(r.taker.nik) : "",
      Nama: r.taker?.name || "",
      Departemen: r.taker?.departement || "",
      "Jenis Cuti": r.leave_type,
      "Tanggal Mulai": new Date(r.start_date).toISOString().slice(0, 10),
      "Tanggal Selesai": new Date(r.end_date).toISOString().slice(0, 10),
      "Total Hari": Number(r.days),
      Keterangan: r.reason || "",
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Cuti ${month}`);
    ws.columns = [
      { width: 12 }, { width: 28 }, { width: 16 }, { width: 12 },
      { width: 14 }, { width: 14 }, { width: 12 }, { width: 40 },
    ];
    if (rows.length > 0) ws.addRow(Object.keys(rows[0]));
    rows.forEach((r) => ws.addRow(Object.values(r)));
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cuti_${month}.xlsx"`);
    res.status(200).send(buf);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// GET /:id — one request. Supervisor only if owner/taker; admin any.
router.get("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await prisma.leave_request.findUnique({
      where: { id: req.params.id },
      include: {
        taker: { select: { name: true, nik: true, departement: true } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isAdmin(req) && r.submitted_by !== req.user.id && r.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.status(200).json({ data: r });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /:id/approve — admin only. Auto-decrements balance for current year if a row exists.
router.patch("/:id/approve", requireRole("admin"), async (req, res) => {
  try {
    const r = await prisma.leave_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot approve a ${r.status} request` });
    }
    const year = new Date(r.start_date).getFullYear();
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.leave_request.update({
        where: { id: r.id },
        data: { status: "approved", approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
      });
      // Decrement balance if a row exists; do nothing otherwise (no auto-create — admin seeds balances).
      const bal = await tx.leave_balance.findUnique({
        where: { user_id_year_leave_type: { user_id: r.user_id, year, leave_type: r.leave_type } },
      });
      if (bal) {
        await tx.leave_balance.update({
          where: { id: bal.id },
          data: { used: { increment: r.days }, updated_at: new Date() },
        });
      }
      return u;
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
    const r = await prisma.leave_request.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") {
      return res.status(409).json({ error: `Cannot reject a ${r.status} request` });
    }
    const updated = await prisma.leave_request.update({
      where: { id: req.params.id },
      data: { status: "rejected", reject_reason: reason.trim(), approved_by: req.user.id, approved_at: new Date(), updated_at: new Date() },
    });
    res.status(200).json({ message: "Rejected", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// shared guard: load request, enforce owner-or-admin + pending
async function loadEditable(req, res) {
  const r = await prisma.leave_request.findUnique({ where: { id: req.params.id } });
  if (!r) { res.status(404).json({ error: "Not found" }); return null; }
  if (!isAdmin(req) && r.submitted_by !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return null;
  }
  if (r.status !== "pending") {
    res.status(409).json({ error: `Cannot modify a ${r.status} request` }); return null;
  }
  return r;
}

// PUT /:id — edit pending request
router.put("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    const { leave_type, start_date, end_date, reason } = req.body;
    if (leave_type && !LEAVE_TYPES.includes(leave_type)) {
      return res.status(400).json({ error: `leave_type must be one of: ${LEAVE_TYPES.join(", ")}` });
    }
    const newStart = start_date ? new Date(start_date) : r.start_date;
    const newEnd = end_date ? new Date(end_date) : r.end_date;
    const days = (start_date || end_date) ? await computeLeaveDays(newStart, newEnd) : Number(r.days);
    if (days <= 0) {
      return res.status(400).json({ error: "leave range contains zero working days" });
    }
    const updated = await prisma.leave_request.update({
      where: { id: r.id },
      data: {
        leave_type: leave_type ?? r.leave_type,
        start_date: newStart,
        end_date: newEnd,
        days,
        reason: reason !== undefined ? (reason?.trim() || null) : r.reason,
        updated_at: new Date(),
      },
    });
    res.status(200).json({ message: "Updated", data: updated });
  } catch (error) {
    if (error.message.includes("end_date")) {
      return res.status(400).json({ error: error.message });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — pending only, owner/admin
router.delete("/:id", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    await prisma.leave_request.delete({ where: { id: r.id } });
    res.status(200).json({ message: "Deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
module.exports.computeLeaveDays = computeLeaveDays;
module.exports.LEAVE_TYPES = LEAVE_TYPES;
