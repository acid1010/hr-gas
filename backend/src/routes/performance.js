const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");

router.post("/post", async (req, res) => {
  const { user_id, quarter, status, description } = req.body;

  try {
    const newPerformance = await prisma.performance.create({
      data: {
        user_id,
        quarter: parseInt(quarter),
        status,
        description,
      },
    });
    res.status(201).json(newPerformance);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal menyimpan data performa", detail: error.message });
  }
});

// 2. GET: Data Dashboard (Top 5 & Worst 10 Logic)
router.get("/", async (req, res) => {
  try {
    const data = await prisma.performance.findMany({
      include: {
        users: true,
      },
    });

    // Pemetaan skor untuk mempermudah frontend

    res.status(200).json({ data: data });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data dashboard" });
  }
});

// GET /api/performance/leaderboard?month=YYYY-MM
router.get("/leaderboard", async (req, res) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, mon] = targetMonth.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    // Working days (Mon–Sat, exclude Sunday)
    let workingDays = 0;
    const cur = new Date(start);
    while (cur < end) {
      if (cur.getDay() !== 0) workingDays++;
      cur.setDate(cur.getDate() + 1);
    }

    const employees = await prisma.users.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nik: true, departement: true, link_image: true },
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
    for (const p of performances) {
      if (!perfMap[p.user_id]) perfMap[p.user_id] = p;
    }

    const ratingMap = { best: 1.0, good: 0.75, average: 0.5, worst: 0.25 };

    const data = employees.map((emp) => {
      const daysPresent = daysMap[emp.id]?.size || 0;
      const attendanceRate = workingDays > 0 ? daysPresent / workingDays : 0;
      const perf = perfMap[emp.id];
      const perfRating = ratingMap[perf?.status?.toLowerCase()] ?? 0;
      const combinedScore = Math.round((attendanceRate * 0.6 + perfRating * 0.4) * 100);

      return {
        user_id: emp.id,
        name: emp.name,
        nik: emp.nik,
        departement: emp.departement,
        link_image: emp.link_image || null,
        attendance_rate: Math.round(attendanceRate * 100),
        performance_status: perf?.status || null,
        performance_rating: Math.round(perfRating * 100),
        combined_score: combinedScore,
      };
    });

    data.sort((a, b) => b.combined_score - a.combined_score);

    res.status(200).json({ month: targetMonth, working_days: workingDays, data });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  console.log("masuk delete");
  try {
    const { id } = req.params;
    await prisma.performance.delete({ where: { id } });
    res
      .status(200)
      .json({ message: "Performance record deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
