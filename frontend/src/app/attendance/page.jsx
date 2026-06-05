"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff, Calendar, Search } from "lucide-react";

const punchLabel = (type) => {
  if (type === 0) return { label: "Check In", color: "#22c55e" };
  if (type === 1) return { label: "Check Out", color: "#5b8df8" };
  return { label: "Unknown", color: "#6b7a99" };
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

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

  const fetchRecords = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `${apiBaseUrl}/api/attendance?date=${date}&page=${page}&limit=50`
      );
      setRecords(res.data || []);
      setTotalPages(res.totalPages || 1);
      setCurrentPage(res.currentPage || 1);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkDevice = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/info`);
      setDeviceStatus(res.connected);
    } catch {
      setDeviceStatus(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/sync`, { method: "POST" });
      setSyncResult(res);
      fetchRecords(1);
    } catch (err) {
      setSyncResult({ message: err.message, synced: 0 });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { fetchRecords(1); }, [date]);
  useEffect(() => { checkDevice(); }, []);

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>
            Fingerprint Device
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight">Attendance</h1>
        </div>

        {/* Device status + sync */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {deviceStatus === true && <><Wifi size={13} style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Device Online</span></>}
            {deviceStatus === false && <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Device Offline</span></>}
            {deviceStatus === null && <><span style={{ color: "#6b7a99" }}>Checking…</span></>}
          </div>

          <button
            onClick={handleSync}
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

      {/* Sync result */}
      {syncResult && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: syncResult.synced > 0 ? "rgba(34,197,94,0.1)" : "rgba(91,141,248,0.08)",
            border: `1px solid ${syncResult.synced > 0 ? "rgba(34,197,94,0.2)" : "rgba(91,141,248,0.15)"}`,
            color: syncResult.synced > 0 ? "#22c55e" : "#5b8df8",
          }}
        >
          {syncResult.message} — {syncResult.synced} new records synced
          {syncResult.skipped > 0 && `, ${syncResult.skipped} skipped`}
        </div>
      )}

      {/* Toolbar */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 justify-between"
        style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "#161c2b",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#c9d1e0",
                colorScheme: "dark",
              }}
            />
          </div>
          <button
            onClick={() => fetchRecords(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <Search size={14} /> Filter
          </button>
        </div>
        <span className="text-xs" style={{ color: "#4a5568" }}>
          {total} record{total !== 1 ? "s" : ""} on {date}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["NIK", "Name", "Department", "Date", "Time", "Type"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase"
                  style={{ color: "#4a5568" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>
                  Loading…
                </td>
              </tr>
            ) : records.length > 0 ? (
              records.map((rec) => {
                const punch = punchLabel(rec.punch_type);
                return (
                  <tr
                    key={rec.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#12161f"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>
                      {rec.users?.nik || rec.device_uid}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {rec.users?.name || <span style={{ color: "#4a5568" }}>Unregistered</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7a99" }}>
                      {rec.users?.departement?.toUpperCase() || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7a99" }}>
                      {formatDate(rec.punch_time)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "#c9d1e0" }}>
                      {formatTime(rec.punch_time)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: `${punch.color}18`, color: punch.color }}
                      >
                        {punch.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>
                  No attendance records for {date}. Try syncing the device.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchRecords(p)}
              className="w-8 h-8 rounded-lg text-sm font-semibold transition-all"
              style={
                p === currentPage
                  ? { background: "#3b6fd4", color: "#fff" }
                  : { background: "#161c2b", color: "#6b7a99", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
