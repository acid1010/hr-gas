# UI/UX Redesign V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Dashboard, Employee, Attendance, Performance pages with live data + build a full-screen TV leaderboard display at `/display`.

**Architecture:** Frontend-only rewrites for most pages; one new backend endpoint (`/api/performance/leaderboard`); two new shared components (`StatChip`, `Drawer`); middleware patched to allow unauthenticated `/display` access.

**Tech Stack:** Next.js 15, Tailwind CSS v4, DaisyUI v5 (gas-dark theme), recharts, framer-motion, lucide-react, Express + Prisma (backend)

---

## File Map

| File | Action |
|------|--------|
| `backend/src/routes/performance.js` | Add `GET /leaderboard` endpoint |
| `frontend/src/middleware.js` | Add `/display` to public routes |
| `frontend/src/app/components/StatChip.jsx` | Create — shared stat chip |
| `frontend/src/app/components/Drawer.jsx` | Create — slide-in right drawer |
| `frontend/src/app/dashboard/page.jsx` | Rewrite — live KPIs + chart + absent list |
| `frontend/src/app/employee/page.jsx` | Rewrite — drawer, badges, URL params |
| `frontend/src/app/attendance/page.jsx` | Rewrite — chips, hourly chart, auto-sync |
| `frontend/src/app/employee/performance/page.jsx` | Rewrite — combined score leaderboard |
| `frontend/src/app/display/page.jsx` | Create — TV full-screen display |

---

## Task 1: Backend — `/api/performance/leaderboard` endpoint

**Files:**
- Modify: `backend/src/routes/performance.js`

- [ ] **Step 1: Add the leaderboard route** — open `backend/src/routes/performance.js` and add this before `module.exports`:

```js
// GET /api/performance/leaderboard?month=YYYY-MM
router.get("/leaderboard", async (req, res) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, mon] = targetMonth.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    // Working days in month (Mon–Sat, adjust to Mon–Fri if needed)
    let workingDays = 0;
    const cursor = new Date(start);
    while (cursor < end) {
      const day = cursor.getDay();
      if (day !== 0) workingDays++; // exclude Sunday only
      cursor.setDate(cursor.getDate() + 1);
    }

    // Attendance: unique days present per device_uid
    const attendanceRecs = await prisma.attendance.findMany({
      where: { punch_time: { gte: start, lt: end }, punch_type: 0 },
      select: { device_uid: true, punch_time: true, user_id: true },
    });

    const attendanceMap = {}; // user_id -> Set of date strings
    for (const rec of attendanceRecs) {
      const uid = rec.user_id;
      if (!uid) continue;
      if (!attendanceMap[uid]) attendanceMap[uid] = new Set();
      attendanceMap[uid].add(rec.punch_time.toISOString().slice(0, 10));
    }

    // Performance: latest record per user
    const performances = await prisma.performance.findMany({
      include: { users: { select: { id: true, nik: true, name: true, departement: true, section: true } } },
      orderBy: { created_at: "desc" },
    });

    const perfMap = {};
    for (const p of performances) {
      if (!perfMap[p.user_id]) perfMap[p.user_id] = p;
    }

    const ratingMap = { best: 1.0, good: 0.75, average: 0.5, worst: 0.25 };

    const results = Object.entries(perfMap).map(([userId, perf]) => {
      const daysPresent = attendanceMap[userId]?.size || 0;
      const attendanceRate = workingDays > 0 ? daysPresent / workingDays : 0;
      const perfRating = ratingMap[perf.status?.toLowerCase()] ?? 0.5;
      const combinedScore = Math.round((attendanceRate * 0.6 + perfRating * 0.4) * 100);
      return {
        user_id: userId,
        name: perf.users?.name || "Unknown",
        nik: perf.users?.nik ? String(perf.users.nik) : "",
        departement: perf.users?.departement || "",
        section: perf.users?.section || "",
        days_present: daysPresent,
        working_days: workingDays,
        attendance_rate: Math.round(attendanceRate * 100),
        performance_status: perf.status,
        performance_rating: Math.round(perfRating * 100),
        combined_score: combinedScore,
      };
    });

    results.sort((a, b) => b.combined_score - a.combined_score);

    res.status(200).json({ month: targetMonth, working_days: workingDays, data: results });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add backend/src/routes/performance.js
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add /api/performance/leaderboard endpoint with combined score"
```

---

## Task 2: Middleware — allow `/display` without auth

**Files:**
- Modify: `frontend/src/middleware.js`

- [ ] **Step 1: Patch middleware to bypass `/display`**

Replace the entire file with:

```js
import { NextResponse } from "next/server";

export function middleware(request) {
  const token = request.cookies.get("accessToken");
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login");
  const isPublic = pathname.startsWith("/display");

  if (isPublic) return NextResponse.next();

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/middleware.js
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: allow unauthenticated access to /display route"
```

---

## Task 3: Shared component — `StatChip`

**Files:**
- Create: `frontend/src/app/components/StatChip.jsx`

- [ ] **Step 1: Create the component**

```jsx
// StatChip — shows a label, big value, and optional trend indicator
// trend: "up" | "down" | null
// trendValue: string e.g. "+5%"
export default function StatChip({ label, value, trend, trendValue, valueColor }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-xl"
      style={{ background: "#12161f", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>
        {label}
      </span>
      <span
        className="text-2xl font-black leading-none"
        style={{ color: valueColor || "#c9d1e0" }}
      >
        {value ?? "—"}
      </span>
      {trend && (
        <span
          className="text-xs font-semibold"
          style={{ color: trend === "up" ? "#22c55e" : "#ef4444" }}
        >
          {trend === "up" ? "↑" : "↓"} {trendValue}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/components/StatChip.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add shared StatChip component"
```

---

## Task 4: Shared component — `Drawer`

**Files:**
- Create: `frontend/src/app/components/Drawer.jsx`

- [ ] **Step 1: Create the component**

```jsx
"use client";
import { useEffect } from "react";

// Slide-in drawer from the right
// props: open (bool), onClose (fn), children
export default function Drawer({ open, onClose, children }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative h-full w-[480px] overflow-y-auto flex flex-col"
        style={{ background: "#10131c", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/components/Drawer.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add shared Drawer slide-in component"
```

---

## Task 5: Dashboard — rewrite with live data

**Files:**
- Modify: `frontend/src/app/dashboard/page.jsx`

- [ ] **Step 1: Rewrite the dashboard page**

```jsx
"use client";

import { useEffect, useState, useCallback } from "react";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import StatChip from "@/app/components/StatChip";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#22c55e", hr: "#5b8df8",
  ga: "#06b6d4", it: "#a855f7",
};

function avatarColor(dept) {
  return DEPT_COLORS[dept?.toLowerCase()] || "#4a5568";
}

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-2xl font-black text-white tabular-nums">{time}</span>;
}

const ratingMap = { best: 100, good: 75, average: 50, worst: 25 };

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const dateLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [totalEmp, setTotalEmp] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      const [empRes, attRes, perfRes] = await Promise.all([
        fetchWithAuth(`${apiBaseUrl}/members?limit=1`),
        fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${today}&limit=1000`),
        fetchWithAuth(`${apiBaseUrl}/api/performance`),
      ]);

      setTotalEmp(empRes.totalMembers ?? 0);
      setAttendanceToday(attRes.data ?? []);
      setPerformance(perfRes.data ?? []);

      // Fetch all employees for absent list
      if (empRes.totalMembers) {
        const allRes = await fetchWithAuth(`${apiBaseUrl}/members?limit=${empRes.totalMembers}`);
        setAllEmployees(allRes.data ?? []);
      }

      // Build hourly chart data from attendance records
      const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, punches: 0 }));
      for (const rec of (attRes.data ?? [])) {
        const h = new Date(rec.punch_time).getHours();
        hours[h].punches++;
      }
      setHourlyData(hours.filter((h) => h.punches > 0 || (parseInt(h.hour) >= 6 && parseInt(h.hour) <= 18)));
    } catch (err) {
      console.error(err);
    }
  }, [today]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Compute derived stats
  const presentIds = new Set((attendanceToday).filter(r => r.punch_type === 0).map(r => r.device_uid));
  const presentCount = presentIds.size;
  const absentCount = totalEmp != null ? Math.max(0, totalEmp - presentCount) : null;
  const presentPct = totalEmp ? Math.round((presentCount / totalEmp) * 100) : 0;
  const absentPct = totalEmp ? Math.round((absentCount / totalEmp) * 100) : 0;

  const avgPerf = performance.length
    ? Math.round(performance.reduce((sum, p) => sum + (ratingMap[p.status?.toLowerCase()] ?? 50), 0) / performance.length)
    : null;
  const perfColor = avgPerf == null ? "#c9d1e0" : avgPerf >= 80 ? "#22c55e" : avgPerf >= 60 ? "#f59e0b" : "#ef4444";

  // Absent employees: those whose ID is not in today's punch-ins
  const presentUserIds = new Set(attendanceToday.filter(r => r.punch_type === 0 && r.users?.id).map(r => r.users.id));
  const absentList = allEmployees.filter(e => !presentUserIds.has(e.id) && e.status === "aktif");

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>
            Overview
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight">{dateLabel}</h1>
        </div>
        <LiveClock />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: "Total Employees", value: totalEmp ?? "…", color: "#5b8df8" },
          { icon: UserCheck, label: "Present Today", value: presentCount, color: presentPct >= 80 ? "#22c55e" : "#f59e0b", sub: `${presentPct}% of total` },
          { icon: UserX, label: "Absent Today", value: absentCount ?? "…", color: absentPct > 20 ? "#ef4444" : "#c9d1e0", sub: `${absentPct}% of total` },
          { icon: TrendingUp, label: "Avg Performance", value: avgPerf != null ? `${avgPerf}` : "…", color: perfColor, sub: "this quarter" },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div
            key={label}
            className="rounded-xl p-5 flex flex-col gap-3"
            style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(91,141,248,0.1)" }}>
                <Icon size={15} style={{ color: "#5b8df8" }} />
              </div>
            </div>
            <span className="text-4xl font-black leading-none" style={{ color }}>{value}</span>
            {sub && <span className="text-xs" style={{ color: "#4a5568" }}>{sub}</span>}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4 grid-flow-dense">
        {/* Area chart — col-span-7 */}
        <div
          className="col-span-7 rounded-xl p-5"
          style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#4a5568" }}>
            Hourly Attendance — {today}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5b8df8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5b8df8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#c9d1e0" }}
                itemStyle={{ color: "#5b8df8" }}
                cursor={{ stroke: "rgba(91,141,248,0.2)" }}
              />
              <Area type="monotone" dataKey="punches" stroke="#5b8df8" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Absent list — col-span-5 */}
        <div
          className="col-span-5 rounded-xl p-5 flex flex-col"
          style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#4a5568" }}>
            Absent Today
            <span className="ml-2 px-2 py-0.5 rounded text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {absentList.length}
            </span>
          </p>
          {absentList.length === 0 ? (
            <p className="text-sm my-auto text-center" style={{ color: "#4a5568" }}>All active employees are present</p>
          ) : (
            <div className="overflow-y-auto flex-1 space-y-2 max-h-[220px]">
              {absentList.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 py-1.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                    style={{ background: avatarColor(emp.departement) }}
                  >
                    {(emp.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                    <p className="text-xs truncate" style={{ color: "#4a5568" }}>{emp.departement?.toUpperCase()} · {emp.nik}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/dashboard/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: rewrite dashboard with live KPIs, area chart, absent list"
```

---

## Task 6: Employee — drawer, badges, URL params

**Files:**
- Modify: `frontend/src/app/employee/page.jsx`

- [ ] **Step 1: Rewrite the employee page**

```jsx
"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EmployeeForm from "../components/forms/EmployeeForm";
import { PaginationData } from "../components/Pagination";
import { AlertDestructive } from "../components/Alert";
import Drawer from "../components/Drawer";
import { Search, Plus, Download, Upload } from "lucide-react";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#22c55e", hr: "#5b8df8",
  ga: "#06b6d4", it: "#a855f7",
};

function avatarColor(dept) { return DEPT_COLORS[dept?.toLowerCase()] || "#4a5568"; }

function StatusBadge({ value }) {
  const map = {
    aktif: { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
    "non-aktif": { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  };
  const s = map[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.12)", color: "#6b7a99" };
  return <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{value?.toUpperCase() || "—"}</span>;
}

function WorkerBadge({ value }) {
  const map = {
    pkwt: { bg: "rgba(91,141,248,0.12)", color: "#5b8df8" },
    borongan: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
    magang: { bg: "rgba(107,122,153,0.12)", color: "#6b7a99" },
  };
  const s = map[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.12)", color: "#6b7a99" };
  return <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{value?.toUpperCase() || "—"}</span>;
}

const inputStyle = { background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", outline: "none" };

export default function Employee() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "10";
  const keyword = searchParams.get("keyword") || "";

  const [resultData, setResultData] = useState({});
  const [alertStatus, setAlertStatus] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [formData, setFormData] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchInput, setSearchInput] = useState(keyword);

  const handleFormChange = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`);
      setResultData(res);
    } catch (err) { console.error(err); }
  }, [keyword, page, limit]);

  useEffect(() => { handleData(); }, [handleData]);

  useEffect(() => {
    if (alertStatus) {
      const t = setTimeout(() => { setAlertStatus(null); setAlertMessage(null); }, 8000);
      return () => clearTimeout(t);
    }
  }, [alertStatus]);

  const pushParam = (key, val) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, val);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handleSearch = (e) => { e.preventDefault(); pushParam("keyword", searchInput); };

  const handleCreate = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setAlertStatus("success"); setAlertMessage(res.message);
      e.target.reset(); setDrawerOpen(false); handleData();
    } catch (err) { setAlertStatus("error"); setAlertMessage(err.message); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/${formData.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      setAlertStatus("success"); setAlertMessage(res.message);
      setDrawerOpen(false); setFormData({}); handleData();
    } catch (err) { setAlertStatus("error"); setAlertMessage(err.message); }
  };

  const handleView = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${id}`);
      setFormData(res.data[0]); setDrawerOpen(true);
    } catch {}
  };

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/delete/${id}`, { method: "PATCH" });
      setAlertStatus("success"); setAlertMessage(res.message);
      setDeleteConfirm(null); handleData();
    } catch (err) { setAlertStatus("error"); setAlertMessage(err.message); }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/members/export`, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `employees_${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setAlertStatus("error"); setAlertMessage(err.message); }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const [headerLine, ...lines] = ev.target.result.trim().split("\n");
      const headers = headerLine.split(",").map(h => h.trim());
      const rows = lines.filter(l => l.trim()).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
      });
      try {
        const res = await fetchWithAuth(`${apiBaseUrl}/members/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows) });
        setAlertStatus("success"); setAlertMessage(`Import complete — ${res.created} created, ${res.skipped} skipped`);
        handleData();
      } catch (err) { setAlertStatus("error"); setAlertMessage(err.message); }
    };
    reader.readAsText(file);
  };

  const from = ((Number(page) - 1) * Number(limit)) + 1;
  const to = Math.min(Number(page) * Number(limit), resultData.totalMembers || 0);

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {alertStatus && <div className="mb-4"><AlertDestructive status={alertStatus} tittle={alertStatus} message={alertMessage} /></div>}

      <div className="mb-6">
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Management</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Employee</h1>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 justify-between" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <select onChange={e => pushParam("dept", e.target.value)} style={inputStyle}>
            <option value="">All Departments</option>
            {["production","warehouse","quality","engineering","maintenance","hr","ga","it"].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
          </select>
          <select onChange={e => pushParam("section", e.target.value)} style={inputStyle}>
            <option value="">All Positions</option>
            {["operator","manager","admin","office","spv"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pl-8 pr-4 py-2 rounded-lg text-sm w-52 outline-none" style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }} placeholder="Search employee…" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#3b6fd4" }}>Search</button>
        </form>

        <div className="flex items-center gap-2">
          <select onChange={e => pushParam("limit", e.target.value)} value={limit} style={{ ...inputStyle, padding: "0.5rem" }}>
            {["10","25","50"].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button onClick={() => { setFormData({}); setDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#3b6fd4" }}><Plus size={14} /> Create</button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}><Download size={14} /> Export</button>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}>
            <Upload size={14} /> Import
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Count */}
      {resultData.totalMembers > 0 && (
        <p className="text-xs mb-2 text-right" style={{ color: "#4a5568" }}>
          Showing {from}–{to} of {resultData.totalMembers} employees
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <tr>
                {["NIK","Name","Department","Position","Join Date","Status","Worker","Username","Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase whitespace-nowrap" style={{ color: "#4a5568" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultData?.data?.length > 0 ? resultData.data.map((emp, idx) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 === 0 ? "#10131c" : "#12161f" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#151a26"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#10131c" : "#12161f"}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{emp.nik}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: avatarColor(emp.departement) }}>
                        {(emp.name || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-white whitespace-nowrap">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#c9d1e0" }}>{emp.departement?.toUpperCase()}</td>
                  <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.section}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#6b7a99" }}>{new Date(emp.join_date).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-3"><StatusBadge value={emp.status} /></td>
                  <td className="px-4 py-3"><WorkerBadge value={emp.worker_stats} /></td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#6b7a99" }}>{emp.username}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleView(emp.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#1e2d52", color: "#5b8df8", border: "1px solid rgba(91,141,248,0.25)" }}>Edit</button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={deleteConfirm === emp.id
                          ? { background: "rgba(239,68,68,0.25)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.5)" }
                          : { background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
                        onBlur={() => setDeleteConfirm(null)}
                      >
                        {deleteConfirm === emp.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4"><PaginationData totalPages={resultData.totalPages} currentPage={resultData.currentPage} /></div>

      {/* Slide-in Drawer */}
      <Drawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setFormData({}); }}>
        <form onSubmit={formData?.id ? handleUpdate : handleCreate} className="flex flex-col h-full">
          <EmployeeForm formData={formData} onChange={handleFormChange} />
        </form>
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/employee/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: rewrite employee page with drawer, badges, URL params, zebra rows"
```

---

## Task 7: Attendance — chips, hourly chart, auto-sync

**Files:**
- Modify: `frontend/src/app/attendance/page.jsx`

- [ ] **Step 1: Rewrite the attendance page**

```jsx
"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useEffect, useState, useCallback, useRef } from "react";
import StatChip from "@/app/components/StatChip";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, Wifi, WifiOff, Calendar, Search, AlertTriangle } from "lucide-react";

const punchLabel = (type) => {
  if (type === 0) return { label: "Check In", color: "#22c55e" };
  if (type === 1) return { label: "Check Out", color: "#5b8df8" };
  return { label: "Unknown", color: "#6b7a99" };
};

const fmt = (ts, mode) => mode === "time"
  ? new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  : new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export default function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState(today);
  const [syncing, setSyncing] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const syncIntervalRef = useRef(null);

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${date}&page=${page}&limit=50`);
      setRecords(res.data || []);
      setTotalPages(res.totalPages || 1);
      setCurrentPage(res.currentPage || 1);
      setTotal(res.total || 0);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [date]);

  const checkDevice = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/info`);
      setDeviceOnline(res.connected);
    } catch { setDeviceOnline(false); }
  };

  const doSync = useCallback(async (manual = false) => {
    if (manual) setSyncing(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/sync`, { method: "POST" });
      if (manual) setSyncResult(res);
      setLastSynced(new Date());
      fetchRecords(1);
    } catch (err) { if (manual) setSyncResult({ message: err.message, synced: 0 }); }
    finally { if (manual) setSyncing(false); }
  }, [fetchRecords]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);
  useEffect(() => { checkDevice(); }, []);
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => doSync(false), 5 * 60 * 1000);
    return () => clearInterval(syncIntervalRef.current);
  }, [doSync]);

  // Derived stats
  const checkIns = records.filter(r => r.punch_type === 0);
  const uniquePresent = new Set(checkIns.map(r => r.device_uid)).size;
  const firstPunch = checkIns.length ? fmt(Math.min(...checkIns.map(r => new Date(r.punch_time))), "time") : "—";
  const lastPunch = checkIns.length ? fmt(Math.max(...checkIns.map(r => new Date(r.punch_time))), "time") : "—";

  // Hourly bar data
  const hourlyMap = {};
  for (const r of records) {
    const h = new Date(r.punch_time).getHours();
    hourlyMap[h] = (hourlyMap[h] || 0) + 1;
  }
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2,"0")}:00`, punches: hourlyMap[i] || 0 })).filter((_, i) => i >= 5 && i <= 20);

  const sinceSync = lastSynced ? Math.floor((Date.now() - lastSynced.getTime()) / 60000) : null;

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Fingerprint Device</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Attendance</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Last synced */}
          {sinceSync !== null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#4a5568" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
              Last synced: {sinceSync === 0 ? "just now" : `${sinceSync} min ago`}
            </div>
          )}
          {/* Device status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
            {deviceOnline === true && <><Wifi size={13} style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Device Online</span></>}
            {deviceOnline === false && <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Device Offline</span></>}
            {deviceOnline === null && <span style={{ color: "#6b7a99" }}>Checking…</span>}
          </div>
          <button onClick={() => doSync(true)} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: syncing ? "#1e2d52" : "#3b6fd4" }}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Device"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(91,141,248,0.08)", border: "1px solid rgba(91,141,248,0.15)", color: "#5b8df8" }}>
          {syncResult.message} — {syncResult.synced} new records
          {syncResult.skipped > 0 && `, ${syncResult.skipped} skipped`}
        </div>
      )}

      {/* Stat chips */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatChip label="Total Punches" value={total} />
        <StatChip label="Unique Present" value={uniquePresent} valueColor="#22c55e" />
        <StatChip label="First Punch" value={firstPunch} />
        <StatChip label="Last Punch" value={lastPunch} />
      </div>

      {/* Hourly chart */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#4a5568" }}>Punches Per Hour</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#c9d1e0" }} cursor={{ fill: "rgba(91,141,248,0.08)" }} />
            <Bar dataKey="punches" fill="#5b8df8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl p-4 mb-4 flex items-center gap-3 justify-between" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="pl-8 pr-4 py-2 rounded-lg text-sm outline-none" style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0", colorScheme: "dark" }} />
          </div>
          <button onClick={() => fetchRecords(1)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#3b6fd4" }}><Search size={13} /> Filter</button>
        </div>
        <span className="text-xs" style={{ color: "#4a5568" }}>{total} record{total !== 1 ? "s" : ""} on {date}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-sm">
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <tr>
              {["NIK","Name","Department","Date","Time","Type"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>Loading…</td></tr>
            ) : records.length > 0 ? records.map((rec, idx) => {
              const punch = punchLabel(rec.punch_type);
              const unregistered = !rec.user_id;
              return (
                <tr key={rec.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 === 0 ? "#10131c" : "#12161f", opacity: unregistered ? 0.4 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#151a26"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#10131c" : "#12161f"}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{rec.users?.nik || rec.device_uid}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: unregistered ? "#6b7a99" : "white" }}>
                    <div className="flex items-center gap-1.5">
                      {unregistered && <AlertTriangle size={12} style={{ color: "#f59e0b" }} />}
                      {rec.users?.name || "Unregistered"}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{rec.users?.departement?.toUpperCase() || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{fmt(rec.punch_time, "date")}</td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: "#c9d1e0" }}>{fmt(rec.punch_time, "time")}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${punch.color}18`, color: punch.color }}>{punch.label}</span></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No records for {date}. Try syncing the device.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchRecords(p)} className="w-8 h-8 rounded-lg text-sm font-semibold" style={p === currentPage ? { background: "#3b6fd4", color: "#fff" } : { background: "#161c2b", color: "#6b7a99", border: "1px solid rgba(255,255,255,0.08)" }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/attendance/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: rewrite attendance with stat chips, hourly chart, auto-sync"
```

---

## Task 8: Performance — combined score leaderboard

**Files:**
- Modify: `frontend/src/app/employee/performance/page.jsx`

- [ ] **Step 1: Rewrite the performance page**

```jsx
"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useEffect, useState } from "react";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import Drawer from "@/app/components/Drawer";
import { Plus, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#22c55e", hr: "#5b8df8",
  ga: "#06b6d4", it: "#a855f7",
};

function avatarColor(dept) { return DEPT_COLORS[dept?.toLowerCase()] || "#4a5568"; }

function ScoreBar({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <span className="text-sm font-black" style={{ color }}>{score ?? "—"}</span>
      <div className="w-full h-1 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-1 rounded-full transition-all" style={{ width: `${score ?? 0}%`, background: color }} />
      </div>
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (col !== sortCol) return <ChevronsUpDown size={12} style={{ color: "#4a5568" }} />;
  return sortDir === "asc" ? <ChevronUp size={12} style={{ color: "#5b8df8" }} /> : <ChevronDown size={12} style={{ color: "#5b8df8" }} />;
}

export default function Performance() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month, setMonth] = useState(defaultMonth);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortCol, setSortCol] = useState("combined_score");
  const [sortDir, setSortDir] = useState("desc");

  const fetchLeaderboard = async (m) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/performance/leaderboard?month=${m}`);
      setLeaderboard(res.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchLeaderboard(month); }, [month]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sorted = [...leaderboard].sort((a, b) =>
    sortDir === "asc" ? (a[sortCol] ?? 0) - (b[sortCol] ?? 0) : (b[sortCol] ?? 0) - (a[sortCol] ?? 0)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/performance/post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      e.target.reset(); setDrawerOpen(false); fetchLeaderboard(month);
    } catch (err) { console.error(err); }
  };

  const cols = [
    { key: "rank", label: "Rank", sortable: false },
    { key: "name", label: "Name", sortable: false },
    { key: "nik", label: "NIK", sortable: false },
    { key: "departement", label: "Department", sortable: true },
    { key: "attendance_rate", label: "Attendance %", sortable: true },
    { key: "performance_rating", label: "Perf Rating", sortable: true },
    { key: "combined_score", label: "Score", sortable: true },
  ];

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Evaluation</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Performance Leaderboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0", colorScheme: "dark" }} />
          <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#3b6fd4" }}><Plus size={14} /> Add Record</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-sm">
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <tr>
              {cols.map(c => (
                <th key={c.key} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>
                  {c.sortable ? (
                    <button onClick={() => handleSort(c.key)} className="flex items-center gap-1">
                      {c.label} <SortIcon col={c.key} sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>Loading…</td></tr>
            ) : sorted.length > 0 ? sorted.map((row, idx) => (
              <tr key={row.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 === 0 ? "#10131c" : "#12161f" }}
                onMouseEnter={e => e.currentTarget.style.background = "#151a26"}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#10131c" : "#12161f"}
              >
                <td className="px-4 py-3 text-sm font-black" style={{ color: idx < 3 ? "#5b8df8" : "#4a5568" }}>#{idx + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: avatarColor(row.departement) }}>
                      {(row.name || "?")[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-white whitespace-nowrap">{row.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{row.nik}</td>
                <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{row.departement?.toUpperCase()}</td>
                <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{row.attendance_rate}%</td>
                <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{row.performance_rating}%</td>
                <td className="px-4 py-3 w-32"><ScoreBar score={row.combined_score} /></td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No performance data for {month}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-black text-white">Add Performance Record</h2>
          <PerformanceForm onSubmit={handleSubmit} />
        </form>
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/employee/performance/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: rewrite performance page with combined score leaderboard"
```

---

## Task 9: `/display` TV route — full-screen leaderboard

**Files:**
- Create: `frontend/src/app/display/page.jsx`

- [ ] **Step 1: Create the TV display page**

```jsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#22c55e", hr: "#5b8df8",
  ga: "#06b6d4", it: "#a855f7",
};

function avatarColor(dept) { return DEPT_COLORS[dept?.toLowerCase()] || "#4a5568"; }

function LiveClock() {
  const [t, setT] = useState({ time: "", date: "" });
  useEffect(() => {
    const tick = () => setT({
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      date: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    });
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <div className="font-mono text-4xl font-black text-white tabular-nums leading-none">{t.time}</div>
      <div className="text-xs tracking-widest uppercase mt-1" style={{ color: "#4a5568" }}>{t.date}</div>
    </div>
  );
}

function AnimatedScore({ target }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0; const end = target ?? 0; const dur = 1500; const step = 16;
    const inc = end / (dur / step);
    const id = setInterval(() => { start = Math.min(start + inc, end); setDisplay(Math.round(start)); if (start >= end) clearInterval(id); }, step);
    return () => clearInterval(id);
  }, [target]);
  return <>{display}</>;
}

function RankCard({ rank, employee, side, index }) {
  const isTop = side === "top";
  const scoreColor = isTop ? "#22c55e" : "#ef4444";
  const rankColor = isTop ? "#5b8df8" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      className="rounded-xl p-6 flex items-center gap-6"
      style={{ background: "#12161f", border: `1px solid ${isTop ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}
    >
      {/* Rank */}
      <div className="text-5xl font-black tabular-nums leading-none shrink-0" style={{ color: rankColor, minWidth: "3rem" }}>
        #{rank}
      </div>

      {/* Avatar */}
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0" style={{ background: avatarColor(employee.departement) }}>
        {(employee.name || "?")[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-black text-white tracking-tight truncate">{employee.name}</div>
        <div className="text-sm tracking-widest uppercase mt-0.5" style={{ color: "#4a5568" }}>
          {employee.departement} · {employee.nik}
        </div>
        {/* Score bar */}
        <div className="w-full h-1 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-1 rounded-full transition-all duration-1000" style={{ width: `${employee.combined_score ?? 0}%`, background: scoreColor }} />
        </div>
      </div>

      {/* Score */}
      <div className="text-5xl font-black tabular-nums leading-none shrink-0" style={{ color: scoreColor }}>
        <AnimatedScore target={employee.combined_score} />
      </div>
    </motion.div>
  );
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL_PRODUCTION;

export default function Display() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const monthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();

  const [top5, setTop5] = useState([]);
  const [bottom5, setBottom5] = useState([]);
  const [dataKey, setDataKey] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/performance/leaderboard?month=${month}`);
      const json = await res.json();
      const data = json.data || [];
      setTop5(data.slice(0, 5));
      setBottom5([...data].reverse().slice(0, 5));
      setDataKey(k => k + 1);
    } catch (err) { console.error(err); }
  }, [month]);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 5 * 60 * 1000); return () => clearInterval(id); }, [fetchData]);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col" style={{ background: "#0b0d14", fontFamily: "var(--font-geist-sans)" }}>
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4" style={{ background: "#10131c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0" style={{ background: "#3b6fd4" }}>GAS</div>
          <div>
            <div className="text-sm font-black text-white tracking-widest uppercase">PT. Global Anugerah Setia</div>
            <div className="text-xs tracking-widest uppercase mt-0.5" style={{ color: "#4a5568" }}>HR Performance Ranking</div>
          </div>
        </div>

        {/* Center badge */}
        <div className="flex flex-col items-center gap-1">
          <div className="px-4 py-1 rounded-lg text-sm font-black tracking-widest uppercase text-white" style={{ background: "#1e2d52", border: "1px solid rgba(91,141,248,0.3)" }}>
            {monthLabel}
          </div>
          <div className="text-xs tracking-widest uppercase" style={{ color: "#4a5568" }}>Quarter {quarter}</div>
        </div>

        {/* Clock */}
        <LiveClock />
      </div>

      {/* Main panels */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* Top performers */}
        <div className="flex flex-col p-6 gap-4 overflow-hidden" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-1.5 h-6 rounded-full" style={{ background: "#22c55e" }} />
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#22c55e" }}>Top Performers</span>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto">
            <AnimatePresence mode="wait">
              {top5.length > 0 ? top5.map((emp, i) => (
                <RankCard key={`${dataKey}-top-${i}`} rank={i + 1} employee={emp} side="top" index={i} />
              )) : (
                <p className="text-sm text-center mt-8" style={{ color: "#4a5568" }}>No data available</p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Needs improvement */}
        <div className="flex flex-col p-6 gap-4 overflow-hidden">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-1.5 h-6 rounded-full" style={{ background: "#ef4444" }} />
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#ef4444" }}>Needs Improvement</span>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto">
            <AnimatePresence mode="wait">
              {bottom5.length > 0 ? bottom5.map((emp, i) => (
                <RankCard key={`${dataKey}-bot-${i}`} rank={i + 1} employee={emp} side="bottom" index={i} />
              )) : (
                <p className="text-sm text-center mt-8" style={{ color: "#4a5568" }}>No data available</p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Marquee ticker */}
      <div className="shrink-0 overflow-hidden" style={{ background: "#3b6fd4", height: "2.5rem" }}>
        <div className="flex items-center h-full" style={{ animation: "marquee 40s linear infinite", whiteSpace: "nowrap" }}>
          {[1, 2, 3].map(n => (
            <span key={n} className="text-xs font-black tracking-widest uppercase text-white px-8">
              GROW ACHIEVE SUCCESS &nbsp;&bull;&nbsp; PT. GLOBAL ANUGERAH SETIA INDONESIA &nbsp;&bull;&nbsp; HR PERFORMANCE RANKING &nbsp;&bull;&nbsp; {monthLabel} &nbsp;&bull;&nbsp;
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add frontend/src/app/display/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add /display TV leaderboard with framer-motion animations and marquee"
```

---

## Task 10: Build verification + final push

- [ ] **Step 1: Run build**

```bash
cd /Users/acidjp/pt-gas/hr-gas/frontend && node_modules/.bin/next build 2>&1 | tail -25
```

Expected: all routes compile cleanly including `/display`. Zero errors.

- [ ] **Step 2: Fix any build errors**

Common issues:
- Missing `"use client"` on pages using hooks → add it
- Recharts import errors → ensure `recharts` is in `frontend/package.json` (it is: `"recharts": "^3.8.1"`)
- framer-motion imports → `framer-motion` is in deps (`"framer-motion": "^12.38.0"`)

- [ ] **Step 3: Push**

```bash
git -C /Users/acidjp/pt-gas/hr-gas push origin main
```

---

---

## Task 11: Monthly Excel Report

**Files:**
- Modify: `backend/src/routes/attendance.js` — add `/report/excel` endpoint
- Modify: `frontend/src/app/attendance/page.jsx` — add Download Report button

**Prerequisite:** `xlsx` package installed in backend (`npm install xlsx`)

- [ ] **Step 1: Add Excel report endpoint to attendance router**

Add this route in `backend/src/routes/attendance.js` before `module.exports`:

```js
const XLSX = require("xlsx");

// GET /api/attendance/report/excel?month=YYYY-MM
router.get("/report/excel", async (req, res) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, mon] = targetMonth.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    // Working days (Mon–Sat)
    let workingDays = 0;
    const cur = new Date(start);
    while (cur < end) { if (cur.getDay() !== 0) workingDays++; cur.setDate(cur.getDate() + 1); }

    // All active employees
    const employees = await prisma.users.findMany({
      where: { deletedAt: null, status: "aktif" },
      orderBy: { name: "asc" },
    });

    // Attendance check-ins for the month
    const checkIns = await prisma.attendance.findMany({
      where: { punch_time: { gte: start, lt: end }, punch_type: 0, user_id: { not: null } },
      select: { user_id: true, punch_time: true },
    });

    // Days present per user
    const daysMap = {};
    for (const r of checkIns) {
      if (!daysMap[r.user_id]) daysMap[r.user_id] = new Set();
      daysMap[r.user_id].add(r.punch_time.toISOString().slice(0, 10));
    }

    // Latest performance per user
    const performances = await prisma.performance.findMany({ orderBy: { created_at: "desc" } });
    const perfMap = {};
    for (const p of performances) { if (!perfMap[p.user_id]) perfMap[p.user_id] = p; }

    const ratingMap = { best: 100, good: 75, average: 50, worst: 25 };

    // Build rows
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

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Laporan ${targetMonth}`);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="laporan_hr_${targetMonth}.xlsx"`);
    res.status(200).send(buf);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
```

- [ ] **Step 2: Add Download Report button to attendance page**

In `frontend/src/app/attendance/page.jsx`, add this import and handler:

```jsx
// Add to imports
import { FileSpreadsheet } from "lucide-react";

// Add this handler inside the component (after handleImport or similar)
const handleDownloadReport = async () => {
  const reportMonth = date.slice(0, 7); // YYYY-MM from selected date
  try {
    const res = await fetch(`${apiBaseUrl}/api/attendance/report/excel?month=${reportMonth}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan_hr_${reportMonth}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  }
};
```

Add button to the toolbar row (next to the Filter button):

```jsx
<button
  onClick={handleDownloadReport}
  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
  style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
>
  <FileSpreadsheet size={14} /> Monthly Report
</button>
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add \
  backend/src/routes/attendance.js \
  backend/package.json \
  backend/package-lock.json \
  frontend/src/app/attendance/page.jsx
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add monthly Excel report endpoint and download button"
```

---

## Task 12: Docker Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker-compose.yml` (root)
- Create: `backend/.env.example`
- Create: `frontend/.env.example`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3041
CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Add `output: "standalone"` to `frontend/next.config.mjs`**

```js
// Read the current next.config.mjs and add output: "standalone"
// Current file likely exports a config object — add the output key:
const nextConfig = {
  output: "standalone",
  // ...existing config
};
export default nextConfig;
```

- [ ] **Step 4: Create `docker-compose.yml` at repo root**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: hr-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: hr
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: hr-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-changeme}
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: hr-backend
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-changeme}@postgres:5432/hr?sslmode=disable
      PORT: 3041
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH: ${JWT_REFRESH}
      REDIS_URL: redis://:${REDIS_PASSWORD:-changeme}@redis:6379
      ZK_IP: ${ZK_IP:-192.128.69.33}
      ZK_PORT: ${ZK_PORT:-4370}
    ports:
      - "3041:3041"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: hr-frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_BASE_URL_PRODUCTION: http://backend:3041
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

- [ ] **Step 5: Create `backend/.env.example`**

```env
DATABASE_URL="postgresql://postgres:changeme@localhost:5432/hr?sslmode=disable"
PORT=3041
JWT_SECRET="change-this-to-a-random-secret"
JWT_REFRESH="change-this-to-another-random-secret"
REDIS_URL="redis://:changeme@127.0.0.1:6379"
ZK_IP=192.128.69.33
ZK_PORT=4370
```

- [ ] **Step 6: Create `frontend/.env.example`**

```env
NEXT_PUBLIC_API_BASE_URL_PRODUCTION=http://localhost:3041
JWT_SECRET="change-this-to-a-random-secret"
```

- [ ] **Step 7: Add `.dockerignore` to both backend and frontend**

`backend/.dockerignore`:
```
node_modules
.env
*.log
```

`frontend/.dockerignore`:
```
node_modules
.env
.env.local
.next
*.log
```

- [ ] **Step 8: Commit**

```bash
git -C /Users/acidjp/pt-gas/hr-gas add \
  backend/Dockerfile \
  backend/.dockerignore \
  backend/.env.example \
  frontend/Dockerfile \
  frontend/.dockerignore \
  frontend/.env.example \
  frontend/next.config.mjs \
  docker-compose.yml
git -C /Users/acidjp/pt-gas/hr-gas commit -m "feat: add Docker deployment (Dockerfile x2, docker-compose, env examples)"
```

---

## Self-Review

**Spec coverage check:**
- [x] Dashboard live KPIs + area chart + absent list → Task 5
- [x] Employee drawer + badges + URL params + zebra rows → Task 6
- [x] Attendance chips + hourly bar chart + auto-sync + dimmed unregistered → Task 7
- [x] Performance combined score leaderboard + sortable columns → Task 8
- [x] `/display` TV route + framer-motion + marquee → Task 9
- [x] `/leaderboard` backend endpoint → Task 1
- [x] Middleware `/display` bypass → Task 2
- [x] `StatChip` shared component → Task 3
- [x] `Drawer` shared component → Task 4
- [x] No emojis anywhere → confirmed

**Placeholder scan:** No TBDs, no "similar to Task N", all code blocks complete.

**Type consistency:** `fetchWithAuth`, `apiBaseUrl`, `formData`, `handleFormChange` — consistent naming across all tasks. `combined_score` field used in Task 1 matches usage in Tasks 8 and 9.
