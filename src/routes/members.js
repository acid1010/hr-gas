const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = "" } = req.query;
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
    });

    res.status(200).json({
      data: members,
      currentPage: Number(page),
      totalPages: Math.ceil(totalMembers / Number(limit)),
      totalMembers,
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

module.exports = router;
