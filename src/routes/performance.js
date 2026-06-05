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
