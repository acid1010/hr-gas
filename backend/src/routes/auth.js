const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../middleware/auth");

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // mencari user di table users
    const findUser = await prisma.users.findFirst({
      where: { username: username.trim() },
    });

    // validasi jika tidak ada
    if (!findUser) {
      return res.status(401).json({ error: "Username Not Found" });
    }

    const cleanHash = findUser.hash.trim();
    // engkripsi password dan compare dengan table users
    const pasCompare = await bcrypt.compare(password, cleanHash);

    if (!pasCompare) {
      return res.status(401).json({ error: "Wrong Password" });
    }

    // membuat token key untuk permission request
    const accessToken = jwt.sign(
      {
        id: findUser.id,
        username: findUser.username,
        roleuser: findUser.role,
        depart: findUser.departement,
        section: findUser.section,
        access: findUser.access,
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );

    const refreshToken = jwt.sign(
      {
        id: findUser.id,
        username: findUser.username,
        roleuser: findUser.role,
        depart: findUser.departement,
        section: findUser.section,
        access: findUser.access,
      },
      process.env.JWT_REFRESH,
      { expiresIn: "7d" },
    );

    const isProduction = process.env.NODE_ENV === "production";

    // Access Token: Masa berlaku pendek
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 20 * 60 * 1000,
    });

    // Refresh Token: Masa berlaku panjang
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: `Login Success hi! ${findUser}` });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message_error: error.message });
  }
});

// Perhatikan urutan (req, res)
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res.status(200).json({ message: "logout success" });
});

router.post("/refresh_token", (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH);
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        username: decoded.username,
        roleuser: decoded.roleuser,
        depart: decoded.depart,
        section: decoded.section,
        access: decoded.access,
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 20 * 60 * 1000,
    });
    res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: "Refresh token invalid" });
  }
});

router.get("/me", authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    roleuser: req.user.roleuser,
    depart: req.user.depart,
    section: req.user.section,
    access: req.user.access,
  });
});

module.exports = router;
