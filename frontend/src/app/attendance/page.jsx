"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import StatChip from "../components/StatChip";
import { RefreshCw, Wifi, WifiOff, Calendar, Search, FileSpreadsheet } from "lucide-react";

const punchLabel = (type) => {
  if (type === 0) return { label: "Check In", color: "#22c55e" };
  if (type === 1) return { label: "Check Out", color: "#5b8df8" };
  return { label: "Unknown", color: "#6b7a99" };
};
const fmt = (ts, opts) => new Date(ts).toLocaleString("id-ID", opts);

export default function Attendance() {
  const today = new Date().toISOString().slice(0, 10);

  const [records, setRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState(today);
  const [syncing, setSyncing] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const autoSyncRef = useRef(null);

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${date}&page=${page}&limit=50`);
      setRecords(res.data || []);
      setTotalPages(res.totalPages || 1);
      setCurrentPage(res.currentPage || 1);
      setTotal(res.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [date]);

  const checkDevice = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/info`);
      setDeviceStatus(res.connected);
    } catch { setDeviceStatus(false); }
  };

  const doSync = async (silent = false) => {
    if (!silent) { setSyncing(true); setSyncResult(null); }
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/sync`, { method: "POST" });
      if (!silent) setSyncResult(res);
      setLastSynced(new Date());
      fetchRecords(1);
    } catch (err) {
      if (!silent) setSyncResult({ message: err.message, synced: 0 });
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);
  useEffect(() => { checkDevice(); }, []);

  // Auto-sync every 5 minutes silently
  useEffect(() => {
    autoSyncRef.current = setInterval(() => doSync(true), 5 * 60 * 1000);
    return () => clearInterval(autoSyncRef.current);
  }, []);

  // Summary stats
  const presentSet = new Set(records.filter(r => r.user_id).map(r => r.user_id));
  const checkIns = records.filter(r => r.punch_type === 0);
  const times = records.map(r => new Date(r.punch_time).getTime());
  const firstPunch = times.length ? fmt(Math.min(...times), { hour: "2-digit", minute: "2-digit" }) : "—";
  const lastPunch = times.length ? fmt(Math.max(...times), { hour: "2-digit", minute: "2-digit" }) : "—";

  // Hourly bar data
  const hourMap = {};
  for (let h = 6; h <= 22; h++) hourMap[h] = 0;
  for (const r of records) {
    const h = new Date(r.punch_time).getHours();
    if (hourMap[h] !== undefined) hourMap[h]++;
  }
  const hourlyData = Object.entries(hourMap).map(([h, count]) => ({
    hour: `${String(h).padStart(2, "0")}`,
    punches: count,
  }));

  const sinceMins = lastSynced ? Math.round((Date.now() - lastSynced.getTime()) / 60000) : null;

  const handleDownloadReport = async () => {
    const reportMonth = date.slice(0, 7);
    try {
      const res = await fetch(`${apiBaseUrl}/api/attendance/report/excel?month=${reportMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan_hr_${reportMonth}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Fingerprint Device</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Attendance</h1>
        </div>
        <div className="flex items-center gap-3">
          {sinceMins !== null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#4a5568" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
              Synced {sinceMins === 0 ? "just now" : `${sinceMins}m ago`}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
            {deviceStatus === true && <><Wifi size={13} style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Online</span></>}
            {deviceStatus === false && <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Offline</span></>}
            {deviceStatus === null && <span style={{ color: "#6b7a99" }}>Checking…</span>}
          </div>
          <button
            onClick={() => doSync(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
            style={{ background: syncing ? "#1e2d52" : "#3b6fd4" }}
            onMouseEnter={e => { if (!syncing) e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { if (!syncing) e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Device"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{
          background: syncResult.synced > 0 ? "rgba(34,197,94,0.1)" : "rgba(91,141,248,0.08)",
          border: `1px solid ${syncResult.synced > 0 ? "rgba(34,197,94,0.2)" : "rgba(91,141,248,0.15)"}`,
          color: syncResult.synced > 0 ? "#22c55e" : "#5b8df8",
        }}>
          {syncResult.message} — {syncResult.synced} new records synced
          {syncResult.skipped > 0 && `, ${syncResult.skipped} skipped`}
        </div>
      )}

      {/* Stat chips */}
      <div className="flex gap-4 mb-4">
        <StatChip label="Total Punches" value={total} color="#5b8df8" />
        <StatChip label="Unique Employees" value={presentSet.size} color="#22c55e" />
        <StatChip label="First Punch" value={firstPunch} color="#c9d1e0" />
        <StatChip label="Last Punch" value={lastPunch} color="#c9d1e0" />
      </div>

      {/* Hourly chart */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#4a5568" }}>Punches by Hour</p>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
            <XAxis dataKey="hour" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#10131c", border: "1px solid rgba(91,141,248,0.2)", borderRadius: 8, color: "#c9d1e0", fontSize: 12 }}
              cursor={{ fill: "rgba(91,141,248,0.08)" }}
            />
            <Bar dataKey="punches" fill="#5b8df8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 justify-between" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0", colorScheme: "dark" }}
            />
          </div>
          <button
            onClick={() => fetchRecords(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <Search size={14} /> Filter
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <FileSpreadsheet size={14} /> Monthly Report
          </button>
        </div>
        <span className="text-xs" style={{ color: "#4a5568" }}>{total} record{total !== 1 ? "s" : ""} on {date}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-sm">
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c" }}>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["NIK", "Name", "Department", "Date", "Time", "Type"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>Loading…</td></tr>
            ) : records.length > 0 ? records.map((rec, i) => {
              const punch = punchLabel(rec.punch_type);
              const isUnregistered = !rec.user_id;
              return (
                <tr
                  key={rec.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isUnregistered ? 0.45 : 1, background: i % 2 === 0 ? "#10131c" : "#12161f" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#151a26"; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#10131c" : "#12161f"; e.currentTarget.style.opacity = isUnregistered ? "0.45" : "1"; }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{rec.users?.nik || rec.device_uid}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: isUnregistered ? "#4a5568" : "#fff" }}>
                    {rec.users?.name || "Unregistered"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{rec.users?.departement?.toUpperCase() || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{fmt(rec.punch_time, { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: "#c9d1e0" }}>{fmt(rec.punch_time, { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${punch.color}18`, color: punch.color }}>{punch.label}</span>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No attendance records for {date}. Try syncing the device.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => fetchRecords(p)}
              className="w-8 h-8 rounded-lg text-sm font-semibold transition-all"
              style={p === currentPage ? { background: "#3b6fd4", color: "#fff" } : { background: "#161c2b", color: "#6b7a99", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
