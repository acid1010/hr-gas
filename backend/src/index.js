require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const redis = require("./config/redis");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { authMiddleware } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const membersRoutes = require("./routes/members");
const performanceRoutes = require("./routes/performance");
const attendanceRoutes = require("./routes/attendance");
const overtimeRoutes = require("./routes/overtime");
const shiftsRoutes = require("./routes/shifts");
const holidaysRoutes = require("./routes/holidays");

const port = process.env.PORT;

const allowedOrigin = [
  "http://localhost:3000",
  "http://localhost:3040",
  "http://192.128.66.69:3040",
  "http://36.93.58.122:3040",
];
const optionsCors = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigin.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Origin not allowed by CORS"));
    }
  },
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Requested-With",
    "Accept",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};

// Chrome Private Network Access — allow LAN origins to reach this loopback server
app.use((req, res, next) => {
  if (req.method === "OPTIONS" && req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});

app.use(cors(optionsCors));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(cookieParser());
app.use("/uploads", (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "attachment");
  next();
}, express.static(path.join(__dirname, "../public/uploads")));

// Auth routes are public (login/refresh must work without a valid access token)
app.use("/auth", authRoutes);

// Protected routes
app.use("/members", authMiddleware, membersRoutes);
app.use(
  "/api/attendance",
  (req, res, next) => {
    if (req.method === "GET" && req.path === "/realtime-display") return next();
    return authMiddleware(req, res, next);
  },
  attendanceRoutes,
);

// /api/performance: leaderboard is public (TV /display screens), everything else requires auth
app.use(
  "/api/performance",
  (req, res, next) => {
    if (req.method === "GET" && req.path === "/leaderboard") return next();
    return authMiddleware(req, res, next);
  },
  performanceRoutes,
);
app.use("/api/overtime", authMiddleware, overtimeRoutes);
app.use("/api/shifts", authMiddleware, shiftsRoutes);
app.use("/api/holidays", authMiddleware, holidaysRoutes);

const startServer = async () => {
  try {
    await redis.connect();
    console.log("Redis connected successfully");

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.log("Fatal error during server startup:", error);
  }
};

startServer();
