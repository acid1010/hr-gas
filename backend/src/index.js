require("dotenv").config();
const express = require("express");
const app = express();
const redis = require("./config/redis");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { authMiddleware } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const membersRoutes = require("./routes/members");
const performanceRoutes = require("./routes/performance");
const attendanceRoutes = require("./routes/attendance");

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

app.use(cors(optionsCors));
app.use(express.json());
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(cookieParser());

// Auth routes are public (login/refresh must work without a valid access token)
app.use("/auth", authRoutes);

// Protected routes
app.use("/members", authMiddleware, membersRoutes);
app.use("/api/attendance", authMiddleware, attendanceRoutes);

// /api/performance: leaderboard is public (TV /display screens), everything else requires auth
app.use(
  "/api/performance",
  (req, res, next) => {
    if (req.method === "GET" && req.path === "/leaderboard") return next();
    return authMiddleware(req, res, next);
  },
  performanceRoutes,
);
// app.use("/overtime", overtimeRoutes);

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
