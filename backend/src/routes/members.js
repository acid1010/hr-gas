const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = "", sort = "name", order = "asc" } = req.query;
    const ALLOWED_SORT = ["name", "nik", "join_date", "departement", "section", "status", "worker_stats"];
    const sortField = ALLOWED_SORT.includes(sort) ? sort : "name";
    const sortOrder = order === "desc" ? "desc" : "asc";
    const skip = (Number(page) - 1) * Number(limit);
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        keyword,
      );

    const where = {
      deletedAt: null, // ⭐ penting: filter soft delete

      ...(keyword && {
        OR: [
          ...(isUUID ? [{ id: keyword }] : []),
          { name: { contains: keyword, mode: "insensitive" } },
          { email: { contains: keyword, mode: "insensitive" } },
          { departement: { contains: keyword, mode: "insensitive" } },
          { section: { contains: keyword, mode: "insensitive" } },
          { status: { contains: keyword, mode: "insensitive" } },
          { worker_stats: { contains: keyword, mode: "insensitive" } },
        ],
      }),
    };

    const totalMembers = await prisma.users.count({ where });
    const members = await prisma.users.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
    });

    res.status(200).json({
      data: members,
      currentPage: Number(page),
      totalPages: Math.ceil(totalMembers / Number(limit)),
      total: totalMembers,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  console.log("masuk post");
  try {
    const handleData = req.body;

    const assyData = {
      ...handleData,
      join_date: handleData.join_date ? new Date(handleData.join_date) : null,
    };
    console.log(handleData);
    const checkNik = await prisma.users.findMany({
      where: {
        nik: handleData.nik,
      },
    });

    if (checkNik.length > 1) {
      return res.status(403).json({ error: "Double NIK" });
    }

    const newMember = await prisma.users.create({
      data: assyData,
    });

    res
      .status(201)
      .json({ message: "Member created successfully", data: newMember });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      nim,
      email,
      departement,
      section,
      status,
      worker_stats,
      join_date,
      link_image,
      shift_id,
    } = req.body;

    console.log(req.body);
    const updatedMember = await prisma.users.update({
      where: { id },
      data: {
        name,
        nim: nim ? Number(nim) : undefined,
        email,
        departement,
        section,
        status,
        worker_stats,
        link_image,
        join_date: join_date ? new Date(join_date) : undefined,
        shift_id: shift_id !== undefined ? (shift_id || null) : undefined,
      },
    });

    res
      .status(200)
      .json({ message: "Member updated successfully", data: updatedMember });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/import", async (req, res) => {
  try {
    const rows = req.body; // array of employee objects
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No data provided" });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        if (!row.nik || !row.name) {
          results.errors.push({ row, reason: "Missing nik or name" });
          continue;
        }

        const existing = await prisma.users.findFirst({ where: { nik: row.nik } });
        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.users.create({
          data: {
            nik: row.nik,
            name: row.name,
            join_date: row.join_date ? new Date(row.join_date) : null,
            status: row.status || null,
            section: row.section || null,
            departement: row.departement || null,
            worker_stats: row.worker_stats || null,
            link_image: row.link_image || null,
          },
        });
        results.created++;
      } catch (err) {
        results.errors.push({ row, reason: err.message });
      }
    }

    res.status(200).json({ message: "Import complete", ...results });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.get("/export", async (req, res) => {
  try {
    const members = await prisma.users.findMany({
      where: { deletedAt: null },
      orderBy: { join_date: "asc" },
    });

    const headers = ["nik", "name", "join_date", "status", "section", "departement", "worker_stats", "email", "username", "role", "access"];
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      headers.join(","),
      ...members.map((m) =>
        headers.map((h) => escape(h === "join_date" && m[h] ? new Date(m[h]).toISOString().slice(0, 10) : m[h])).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="employees_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(lines.join("\n"));
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.patch("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.users.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.status(200).json({ message: "Member deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /:id/shift — assign/unassign a worker's shift
router.patch("/:id/shift", async (req, res) => {
  try {
    const { shift_id } = req.body;
    if (shift_id) {
      const shift = await prisma.shift.findUnique({ where: { id: shift_id } });
      if (!shift) return res.status(400).json({ error: "Shift not found" });
    }
    const updated = await prisma.users.update({
      where: { id: req.params.id },
      data: { shift_id: shift_id || null },
    });
    res.status(200).json({ message: "Shift assigned", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
