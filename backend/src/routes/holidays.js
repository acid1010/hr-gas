const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

// GET /?year=YYYY — list (admin + supervisor)
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const data = await prisma.holiday.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST / — create (admin); 409 on duplicate date
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });
    const existing = await prisma.holiday.findUnique({ where: { date: new Date(date) } });
    if (existing) return res.status(409).json({ error: "Holiday already exists for that date" });
    const created = await prisma.holiday.create({ data: { date: new Date(date), name: name || null } });
    res.status(201).json({ message: "Holiday created", data: created });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — admin
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Holiday deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
