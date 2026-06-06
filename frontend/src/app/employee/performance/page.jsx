"use client";

import { useEffect, useState, useCallback } from "react";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import Drawer from "@/app/components/Drawer";
import { Plus } from "lucide-react";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(dept) { return DEPT_COLORS[(dept || "").toLowerCase()] || "#4a5568"; }

const PERF_STYLE = {
  best: { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
  good: { bg: "rgba(91,141,248,0.12)", color: "#5b8df8" },
  average: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  worst: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
};

function ScoreBar({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <span className="text-sm font-black" style={{ color }}>{score}</span>
      <div className="mt-1 h-1 rounded-full w-24" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-1 rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <button onClick={() => { setConfirming(false); onConfirm(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#ef4444", color: "#fff" }} onMouseLeave={() => setConfirming(false)}>
        Confirm?
      </button>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}>
      Delete
    </button>
  );
}

export default function Performance() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [leaderboard, setLeaderboard] = useState([]);
  const [perfRecords, setPerfRecords] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState("combined_score");
  const [sortDir, setSortDir] = useState(-1);
  const [tab, setTab] = useState("leaderboard");

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`);
      setLeaderboard(res.data || []);
    } catch (err) { console.error(err); }
  }, [month]);

  const loadPerf = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/performance`);
      setPerfRecords(res.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);
  useEffect(() => { loadPerf(); }, [loadPerf]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/performance/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      e.target.reset();
      setDrawerOpen(false);
      loadLeaderboard();
      loadPerf();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/performance/delete/${id}`, { method: "DELETE" });
      loadLeaderboard();
      loadPerf();
    } catch (err) { console.error(err); }
  };

  const sort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const sorted = [...leaderboard].sort((a, b) => sortDir * (b[sortKey] - a[sortKey]));

  const SortTh = ({ k, label }) => (
    <th
      className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase cursor-pointer select-none"
      style={{ color: sortKey === k ? "#5b8df8" : "#4a5568" }}
      onClick={() => sort(k)}
    >
      {label} {sortKey === k ? (sortDir === -1 ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Leaderboard</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Performance</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0", colorScheme: "dark" }}
          />
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <Plus size={15} /> Add Record
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[["leaderboard", "Leaderboard"], ["records", "Performance Records"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === k ? { background: "#1e2d52", color: "#5b8df8" } : { color: "#6b7a99" }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "leaderboard" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm">
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c" }}>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>Rank</th>
                <th className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>Employee</th>
                <th className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>Department</th>
                <SortTh k="attendance_rate" label="Attendance %" />
                <th className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>Perf Rating</th>
                <SortTh k="combined_score" label="Combined Score" />
              </tr>
            </thead>
            <tbody>
              {sorted.length > 0 ? sorted.map((emp, i) => {
                const rank = i + 1;
                const rankColor = rank <= 3 ? "#5b8df8" : "#4a5568";
                const perf = PERF_STYLE[emp.performance_status?.toLowerCase()] || { bg: "rgba(107,122,153,0.1)", color: "#6b7a99" };
                return (
                  <tr
                    key={emp.user_id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "#10131c" : "#12161f" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#151a26"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#10131c" : "#12161f"; }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-lg font-black" style={{ color: rankColor }}>#{rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: deptColor(emp.departement) }}>
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{emp.name}</p>
                          <p className="text-xs font-mono" style={{ color: "#4a5568" }}>{emp.nik}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.departement?.toUpperCase()}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {emp.attendance_rate}%
                    </td>
                    <td className="px-4 py-3">
                      {emp.performance_status ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: perf.bg, color: perf.color }}>
                          {emp.performance_status.toUpperCase()}
                        </span>
                      ) : <span style={{ color: "#4a5568" }}>—</span>}
                    </td>
                    <td className="px-4 py-3"><ScoreBar score={emp.combined_score} /></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No data for {month}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "records" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Quarter", "NIK", "Employee", "Status", "Description", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfRecords.length > 0 ? perfRecords.map((item, i) => {
                const perf = PERF_STYLE[item.status?.toLowerCase()] || { bg: "rgba(107,122,153,0.1)", color: "#6b7a99" };
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "#10131c" : "#12161f" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#151a26"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#10131c" : "#12161f"; }}
                  >
                    <td className="px-4 py-3 font-semibold" style={{ color: "#c9d1e0" }}>Q{item.quarter}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{item.users?.nik}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.users?.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: perf.bg, color: perf.color }}>{item.status?.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{item.description || "—"}</td>
                    <td className="px-4 py-3"><DeleteButton onConfirm={() => handleDelete(item.id)} /></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No performance records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Performance Record">
        <form onSubmit={handleSubmit} id="createPerformance" className="flex flex-col gap-4">
          <PerformanceForm onSubmit={handleSubmit} />
          <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: "#3b6fd4" }} onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}>
            Save Record
          </button>
        </form>
      </Drawer>
    </div>
  );
}
