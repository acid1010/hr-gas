"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, CalendarX, TrendingUp, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};

function deptColor(dept) {
  return DEPT_COLORS[(dept || "").toLowerCase()] || "#4a5568";
}

function KpiCard({ icon: Icon, label, value, sub, accent = "#5b8df8" }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight" style={{ color: accent }}>{value}</p>
        <p className="text-xs font-bold tracking-widest uppercase mt-0.5" style={{ color: "#6b7a99" }}>{label}</p>
        {sub && <p className="text-xs mt-1" style={{ color: "#4a5568" }}>{sub}</p>}
      </div>
    </div>
  );
}

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Dashboard() {
  const clock = useClock();
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [kpi, setKpi] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0, avgPerf: 0 });
  const [hourlyData, setHourlyData] = useState([]);
  const [absentList, setAbsentList] = useState([]);

  const load = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      const [membersRes, attendanceRes, perfRes] = await Promise.all([
        fetchWithAuth(`${apiBaseUrl}/members?limit=1`),
        fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${todayStr}&limit=500`),
        fetchWithAuth(`${apiBaseUrl}/api/performance`),
      ]);

      const totalEmployees = membersRes?.total || 0;
      const allPunches = attendanceRes?.data || [];
      const presentSet = new Set(allPunches.filter(r => r.user_id).map(r => r.user_id));
      const presentToday = presentSet.size;
      const absentToday = Math.max(0, totalEmployees - presentToday);

      // Hourly buckets 06–22
      const hourMap = {};
      for (let h = 6; h <= 22; h++) hourMap[h] = 0;
      for (const r of allPunches) {
        const h = new Date(r.punch_time).getHours();
        if (hourMap[h] !== undefined) hourMap[h]++;
      }
      const hourlyData = Object.entries(hourMap).map(([h, count]) => ({
        hour: `${String(h).padStart(2, "0")}:00`,
        punches: count,
      }));

      // Avg performance
      const perfData = perfRes?.data || [];
      const ratingMap = { best: 100, good: 75, average: 50, worst: 25 };
      const scores = perfData.map(p => ratingMap[p.status?.toLowerCase()] ?? 0).filter(Boolean);
      const avgPerf = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Absent list — employees with no punch today
      const allMembers = membersRes?.data || [];
      const absent = allMembers.filter(emp => !presentSet.has(emp.id));

      setKpi({ totalEmployees, presentToday, absentToday, avgPerf });
      setHourlyData(hourlyData);
      setAbsentList(absent);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const perfAccent = kpi.avgPerf >= 80 ? "#22c55e" : kpi.avgPerf >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm" style={{ color: "#6b7a99" }}>HR Portal — PT. Global Anugerah Setia</p>
          <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">{today}</h1>
        </div>
        <p className="text-3xl font-black tracking-widest font-mono" style={{ color: "#5b8df8" }}>{clock}</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Total Employees" value={kpi.totalEmployees} accent="#5b8df8" />
        <KpiCard
          icon={CalendarX}
          label="Present Today"
          value={kpi.presentToday}
          sub={kpi.totalEmployees ? `${Math.round((kpi.presentToday / kpi.totalEmployees) * 100)}% of workforce` : ""}
          accent="#22c55e"
        />
        <KpiCard
          icon={CalendarX}
          label="Absent Today"
          value={kpi.absentToday}
          accent={kpi.absentToday > kpi.totalEmployees * 0.2 ? "#ef4444" : "#f59e0b"}
        />
        <KpiCard icon={TrendingUp} label="Avg Performance" value={`${kpi.avgPerf}`} sub="out of 100" accent={perfAccent} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hourly chart */}
        <div
          className="col-span-12 xl:col-span-7 rounded-xl p-5"
          style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#4a5568" }}>
            Attendance Punches — Today
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5b8df8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5b8df8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#10131c", border: "1px solid rgba(91,141,248,0.2)", borderRadius: 8, color: "#c9d1e0", fontSize: 12 }}
                cursor={{ stroke: "rgba(91,141,248,0.2)" }}
              />
              <Area type="monotone" dataKey="punches" stroke="#5b8df8" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Absent list */}
        <div
          className="col-span-12 xl:col-span-5 rounded-xl flex flex-col"
          style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>
              Absent Today
              {absentList.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                  {absentList.length}
                </span>
              )}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 220 }}>
            {absentList.length === 0 ? (
              <div className="flex items-center justify-center h-full py-8">
                <p className="text-sm" style={{ color: "#4a5568" }}>All employees present</p>
              </div>
            ) : (
              absentList.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                    style={{ background: deptColor(emp.departement) }}
                  >
                    {(emp.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                    <p className="text-xs truncate" style={{ color: "#4a5568" }}>
                      {emp.nik} · {emp.departement?.toUpperCase() || "—"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
