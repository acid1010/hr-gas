const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const ZKLib = require("node-zklib");
const ExcelJS = require("exceljs");
const { countWorkingDays, getHolidaySet } = require("../lib/workingDays");
const zkRealtime = require("../lib/zkRealtime");

const DEVICE_IP = process.env.ZK_IP || "192.128.69.33";
const DEVICE_PORT = parseInt(process.env.ZK_PORT || "4370");
const DEVICE_TIMEOUT = 10000;
const DEVICE_INPORT = 4000;

// POST /attendance/sync — pull logs from ZKTeco device and upsert to DB
router.post("/sync", async (req, res) => {
  let zk = null;
  try {
    zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
    await zk.createSocket();

    const { data: logs } = await zk.getAttendances();

    if (!logs || logs.length === 0) {
      await zk.disconnect();
      return res.status(200).json({ message: "No records on device", synced: 0 });
    }

    // Map device user IDs to DB users via nik
    const deviceUserIds = [...new Set(logs.map((l) => String(l.deviceUserId)))];
    const dbUsers = await prisma.users.findMany({
      where: { nik: { in: deviceUserIds.map((id) => parseFloat(id)) } },
      select: { id: true, nik: true },
    });

    const nikToUserId = {};
    for (const u of dbUsers) {
      nikToUserId[String(u.nik)] = u.id;
    }

    let synced = 0;
    let skipped = 0;

    for (const log of logs) {
      const deviceUid = String(log.deviceUserId);
      const punchTime = new Date(log.recordTime);
      const userId = nikToUserId[deviceUid] || null;

      try {
        await prisma.attendance.upsert({
          where: { device_uid_punch_time: { device_uid: deviceUid, punch_time: punchTime } },
          create: {
            device_uid: deviceUid,
            punch_time: punchTime,
            punch_type: log.type ?? 0,
            user_id: userId,
          },
          update: {
            punch_type: log.type ?? 0,
            user_id: userId,
          },
        });
        synced++;
      } catch {
        skipped++;
      }
    }

    await zk.disconnect();
    res.status(200).json({ message: "Sync complete", synced, skipped, total: logs.length });
  } catch (error) {
    if (zk) { try { await zk.disconnect(); } catch {} }
    res.status(500).json({ message: "Device sync failed", error: error.message });
  }
});

// GET /attendance/realtime — SSE live punch feed
router.get("/realtime", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  zkRealtime.addClient(res);
  req.on("close", () => zkRealtime.removeClient(res));
});

// GET /attendance?date=YYYY-MM-DD&user_id=...&page=1&limit=50
router.get("/", async (req, res) => {
  try {
    const { date, user_id, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.punch_time = { gte: start, lt: end };
    }

    if (user_id) {
      where.user_id = user_id;
    }

    const [total, records] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        include: { users: { select: { id: true, nik: true, name: true, departement: true, section: true, link_image: true } } },
        orderBy: { punch_time: "desc" },
        skip,
        take: Number(limit),
      }),
    ]);

    res.status(200).json({
      data: records,
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// GET /attendance/summary?month=YYYY-MM — per-user attendance count for the month
router.get("/summary", async (req, res) => {
  try {
    const { month } = req.query;
    const start = month ? new Date(`${month}-01`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    // Get all punch-in records (type 0) grouped by user and date
    const records = await prisma.attendance.findMany({
      where: { punch_time: { gte: start, lt: end }, punch_type: 0 },
      include: { users: { select: { id: true, nik: true, name: true, departement: true, link_image: true } } },
      orderBy: { punch_time: "asc" },
    });

    // Group by user, count unique days present
    const summaryMap = {};
    for (const rec of records) {
      const uid = rec.device_uid;
      const dateKey = rec.punch_time.toISOString().slice(0, 10);
      if (!summaryMap[uid]) {
        summaryMap[uid] = {
          device_uid: uid,
          user: rec.users || null,
          days_present: new Set(),
          punches: [],
        };
      }
      summaryMap[uid].days_present.add(dateKey);
      summaryMap[uid].punches.push(rec.punch_time);
    }

    const summary = Object.values(summaryMap).map((s) => ({
      device_uid: s.device_uid,
      user: s.user,
      days_present: s.days_present.size,
      first_punch: s.punches[0],
      last_punch: s.punches[s.punches.length - 1],
    }));

    res.status(200).json({ month: start.toISOString().slice(0, 7), data: summary });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// GET /attendance/report/excel?month=YYYY-MM — monthly Excel report
router.get("/report/excel", async (req, res) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, mon] = targetMonth.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    const holidays = await getHolidaySet(prisma, start, end);
    const workingDays = countWorkingDays(start, end, holidays);

    const employees = await prisma.users.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });

    const checkIns = await prisma.attendance.findMany({
      where: { punch_time: { gte: start, lt: end }, punch_type: 0, user_id: { not: null } },
      select: { user_id: true, punch_time: true },
    });

    const daysMap = {};
    for (const r of checkIns) {
      if (!daysMap[r.user_id]) daysMap[r.user_id] = new Set();
      daysMap[r.user_id].add(r.punch_time.toISOString().slice(0, 10));
    }

    const performances = await prisma.performance.findMany({ orderBy: { created_at: "desc" } });
    const perfMap = {};
    for (const p of performances) { if (!perfMap[p.user_id]) perfMap[p.user_id] = p; }

    const ratingMap = { best: 100, good: 75, average: 50, worst: 25 };

    const rows = employees.map((emp) => {
      const daysPresent = daysMap[emp.id]?.size || 0;
      const daysAbsent = Math.max(0, workingDays - daysPresent);
      const attendancePct = workingDays > 0 ? Math.round((daysPresent / workingDays) * 100) : 0;
      const perf = perfMap[emp.id];
      const perfRating = ratingMap[perf?.status?.toLowerCase()] ?? 0;
      const combinedScore = Math.round((attendancePct / 100 * 0.6 + perfRating / 100 * 0.4) * 100);
      return {
        NIK: emp.nik ? String(emp.nik) : "",
        Nama: emp.name || "",
        Departemen: emp.departement?.toUpperCase() || "",
        Jabatan: emp.section || "",
        "Status Kerja": emp.worker_stats?.toUpperCase() || "",
        "Hari Kerja": workingDays,
        "Hari Hadir": daysPresent,
        "Hari Absen": daysAbsent,
        "Kehadiran (%)": attendancePct,
        "Status Performa": perf?.status?.toUpperCase() || "—",
        "Rating Performa": perfRating,
        "Skor Gabungan": combinedScore,
        Keterangan: perf?.description || "",
      };
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Laporan ${targetMonth}`);
    ws.columns = [
      { width: 12 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 12 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 16 },
      { width: 16 }, { width: 14 }, { width: 30 },
    ];
    if (rows.length > 0) ws.addRow(Object.keys(rows[0]));
    rows.forEach(r => ws.addRow(Object.values(r)));
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="laporan_hr_${targetMonth}.xlsx"`);
    res.status(200).send(buf);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// GET /attendance/device/users — enrolled device users cross-referenced with DB
router.get("/device/users", async (req, res) => {
  let zk = null;
  try {
    zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
    await zk.createSocket();
    const { data: deviceUsers } = await zk.getUsers();
    await zk.disconnect();

    const dbEmployees = await prisma.users.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nik: true, departement: true, section: true },
    });

    const dbByNik = {};
    for (const emp of dbEmployees) {
      dbByNik[String(emp.nik)] = emp;
    }

    const deviceNiks = new Set();
    const matched = [];
    const unregistered = [];

    for (const du of deviceUsers) {
      const nik = String(du.userId).trim();
      deviceNiks.add(nik);
      const dbUser = dbByNik[nik];
      if (dbUser) {
        matched.push({ device: du, db: dbUser });
      } else {
        unregistered.push({ device: du });
      }
    }

    const notOnDevice = dbEmployees
      .filter((emp) => !deviceNiks.has(String(emp.nik)))
      .map((emp) => ({ db: emp }));

    res.status(200).json({
      total_device: deviceUsers.length,
      total_db: dbEmployees.length,
      matched,
      unregistered,
      notOnDevice,
    });
  } catch (error) {
    if (zk) { try { await zk.disconnect(); } catch {} }
    res.status(500).json({ message: "Failed to fetch device users", error: error.message });
  }
});

// GET /attendance/device/info — check device connection
router.get("/device/info", async (req, res) => {
  let zk = null;
  try {
    zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
    await zk.createSocket();
    const info = await zk.getInfo();
    await zk.disconnect();
    res.status(200).json({ connected: true, ip: DEVICE_IP, port: DEVICE_PORT, info });
  } catch (error) {
    if (zk) { try { await zk.disconnect(); } catch {} }
    res.status(503).json({ connected: false, ip: DEVICE_IP, port: DEVICE_PORT, error: error.message });
  }
});

module.exports = router;
