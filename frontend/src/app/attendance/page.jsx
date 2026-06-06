"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { RefreshCw, Wifi, WifiOff, Calendar, Search, FileSpreadsheet, Activity, Users, Clock } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";
import { SkeletonTable } from "@/app/components/SkeletonRow";

const fmt = (ts, opts) => new Date(ts).toLocaleString("id-ID", opts);

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(d) { return DEPT_COLORS[(d || "").toLowerCase()] || "#4a5568"; }

function getDrivePreview(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s200` : url;
}

const rowVariants = {
  hidden:  { opacity: 0, y: 5 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.028, duration: 0.32, ease: [0.22, 1, 0.36, 1] } }),
};

function ChartTooltip({ active, payload, label, bg, text }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: bg, border: "1px solid rgba(91,141,248,0.3)", borderRadius: 10, padding: "8px 14px", color: text, fontSize: 12, fontWeight: 700, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
      <div style={{ color: "#5b8df8", marginBottom: 2 }}>{label}:00</div>
      <div>{payload[0].value} punches</div>
    </div>
  );
}

export default function Attendance() {
  const { t, p } = useAppSettings();
  const today = new Date().toISOString().slice(0, 10);

  const [records,     setRecords]     = useState([]);
  const [totalPages,  setTotalPages]  = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [total,       setTotal]       = useState(0);
  const [date,        setDate]        = useState(today);
  const [syncing,     setSyncing]     = useState(false);
  const [deviceStatus,setDeviceStatus]= useState(null);
    const [loading,     setLoading]     = useState(false);
  const [lastSynced,  setLastSynced]  = useState(null);
  const [nameFilter,  setNameFilter]  = useState("");
  const autoSyncRef = useRef(null);

  const punchLabel = (type) => {
    if (type === 0) return { label: t("attendance.checkIn"),  color: "#22c55e" };
    if (type === 1) return { label: t("attendance.checkOut"), color: "#5b8df8" };
    return { label: t("attendance.unknown"), color: "#6b7a99" };
  };

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
    if (!silent) setSyncing(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/sync`, { method: "POST" });
      if (!silent) {
        const type = res.synced > 0 ? "success" : "info";
        const msg = `${res.message} — ${res.synced} ${t("attendance.syncResult")}${res.skipped > 0 ? `, ${res.skipped} ${t("attendance.syncSkipped")}` : ""}`;
        toast(msg, type);
      }
      setLastSynced(new Date());
      fetchRecords(1);
    } catch (err) {
      if (!silent) toast(err.message, "error");
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);
  useEffect(() => { checkDevice(); }, []);
  useEffect(() => {
    autoSyncRef.current = setInterval(() => doSync(true), 5 * 60 * 1000);
    return () => clearInterval(autoSyncRef.current);
  }, []);

  const filteredRecords = nameFilter.trim()
    ? records.filter(r => {
        const q = nameFilter.toLowerCase();
        return (r.users?.name || "").toLowerCase().includes(q) ||
               String(r.users?.nik || r.device_uid || "").includes(q) ||
               (r.users?.departement || "").toLowerCase().includes(q);
      })
    : records;

  const presentSet  = new Set(records.filter(r => r.user_id).map(r => r.user_id));
  const times       = records.map(r => new Date(r.punch_time).getTime());
  const firstPunch  = times.length ? fmt(Math.min(...times), { hour: "2-digit", minute: "2-digit" }) : "—";
  const lastPunch   = times.length ? fmt(Math.max(...times), { hour: "2-digit", minute: "2-digit" }) : "—";
  const sinceMins   = lastSynced ? Math.round((Date.now() - lastSynced.getTime()) / 60000) : null;

  const hourMap = {};
  for (let h = 6; h <= 22; h++) hourMap[h] = 0;
  for (const r of records) {
    const h = new Date(r.punch_time).getHours();
    if (hourMap[h] !== undefined) hourMap[h]++;
  }
  const hourlyData = Object.entries(hourMap).map(([h, cnt]) => ({ hour: String(h).padStart(2, "0"), punches: cnt }));

  const handleDownloadReport = async () => {
    const reportMonth = date.slice(0, 7);
    try {
      const res = await fetch(`${apiBaseUrl}/api/attendance/report/excel?month=${reportMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `laporan_hr_${reportMonth}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(err.message, "error"); }
  };

  const statItems = [
    { label: t("attendance.totalPunches"),    value: total,           accent: "#5b8df8", Icon: Activity, isText: false },
    { label: t("attendance.uniqueEmployees"), value: presentSet.size, accent: "#22c55e", Icon: Users,    isText: false },
    { label: t("attendance.firstPunch"),      value: firstPunch,      accent: p.text,    Icon: Clock,    isText: true  },
    { label: t("attendance.lastPunch"),       value: lastPunch,       accent: p.muted,   Icon: Clock,    isText: true  },
  ];

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-end justify-between gap-6 flex-wrap"
        >
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1.5" style={{ color: p.primary }}>
              {t("attendance.subtitle")}
            </p>
            <h1 className="text-[2rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
              {t("attendance.title")}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {sinceMins !== null && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: p.faint }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 5px #22c55e88" }} />
                {t("attendance.lastSynced")} {sinceMins === 0 ? t("attendance.justNow") : `${sinceMins}${t("attendance.minutesAgo")}`}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
              {deviceStatus === true  && <><Wifi    size={13} style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>{t("attendance.deviceOnline")}</span></>}
              {deviceStatus === false && <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>{t("attendance.deviceOffline")}</span></>}
              {deviceStatus === null  && <span style={{ color: p.faint }}>{t("attendance.checking")}</span>}
            </div>

            <motion.button
              onClick={() => doSync(false)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: syncing ? "#1e2d52" : "#3b6fd4", cursor: syncing ? "not-allowed" : "pointer" }}
              whileHover={!syncing ? { scale: 1.02, backgroundColor: "#2f5cb8" } : {}}
              whileTap={!syncing ? { scale: 0.97 } : {}}
              transition={{ duration: 0.15 }}
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? t("attendance.syncing") : t("attendance.syncDevice")}
            </motion.button>
          </div>
        </motion.div>


        {/* STAT CHIPS — 4×1 bento, zero gaps */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          {statItems.map(({ label, value, accent, Icon, isText }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl p-5 flex items-center gap-4 transition-colors duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
                <Icon size={17} style={{ color: accent }} />
              </div>
              <div className="min-w-0">
                <p className={`font-black leading-none truncate ${isText ? "text-xl" : "text-2xl"}`} style={{ color: accent }}>
                  {value}
                </p>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase mt-1 truncate" style={{ color: p.faint }}>
                  {label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* BAR CHART */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl mb-5 overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.border}` }}>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>{t("attendance.punchesByHour")}</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded-full" style={{ background: "#5b8df8" }} />
              <span className="text-[10px] font-bold" style={{ color: p.faint }}>punches / hr</span>
            </div>
          </div>
          <div className="px-6 py-5">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={hourlyData} margin={{ top: 2, right: 0, bottom: 0, left: -28 }}>
                <XAxis dataKey="hour" tick={{ fill: p.faint, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
                <YAxis tick={{ fill: p.faint, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip bg={p.cardBg} text={p.text} />} />
                <Bar dataKey="punches" fill="#5b8df8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* TOOLBAR */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45 }}
          className="mb-4 flex flex-wrap items-center gap-3 justify-between p-4 rounded-2xl transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Calendar size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text, colorScheme: "dark" }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
                onBlur={e =>  { e.target.style.borderColor = p.border2;  e.target.style.boxShadow = "none"; }}
              />
            </div>
            <motion.button
              onClick={() => fetchRecords(1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: "#3b6fd4" }}
              whileHover={{ scale: 1.02, backgroundColor: "#2f5cb8" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Search size={14} /> {t("common.filter")}
            </motion.button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = p.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border2; e.currentTarget.style.color = p.muted; }}
            >
              <FileSpreadsheet size={14} /> {t("attendance.monthlyReport")}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 w-full xl:mt-0 xl:w-auto xl:ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
              <input
                type="text"
                placeholder={t("attendance.filterName") || "Filter by name / NIK…"}
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-xl text-sm outline-none transition-all w-52"
                style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
                onBlur={e =>  { e.target.style.borderColor = p.border2;  e.target.style.boxShadow = "none"; }}
              />
            </div>
            <span className="text-xs font-medium" style={{ color: p.faint }}>
              {filteredRecords.length !== records.length
                ? `${filteredRecords.length} / ${total}`
                : `${total}`} {t("attendance.records")}
            </span>
          </div>
        </motion.div>

        {/* TABLE */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                {[t("attendance.columns.nik"), t("attendance.columns.name"), t("attendance.columns.date"), t("attendance.columns.time"), t("attendance.columns.type")].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <motion.tbody
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.028 } } }}
            >
              {loading ? (
                <SkeletonTable rows={10} cols={5} />
              ) : filteredRecords.length > 0 ? filteredRecords.map((rec, i) => {
                const punch         = punchLabel(rec.punch_type);
                const isUnregistered = !rec.user_id;
                return (
                  <motion.tr
                    key={rec.id}
                    custom={i}
                    variants={rowVariants}
                    className="transition-colors duration-150"
                    style={{ borderBottom: `1px solid ${p.border}`, opacity: isUnregistered ? 0.45 : 1, background: i % 2 === 0 ? p.cardBg : p.rowAlt }}
                    onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; e.currentTarget.style.opacity = isUnregistered ? "0.45" : "1"; }}
                  >
                    {/* NIK chip */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>
                        {rec.users?.nik || rec.device_uid}
                      </span>
                    </td>

                    {/* Name + dept */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {!isUnregistered && (
                          <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(rec.users?.departement) }}>
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                              {(rec.users?.name || "?")[0].toUpperCase()}
                            </div>
                            {rec.users?.link_image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getDrivePreview(rec.users.link_image)} alt={rec.users.name} className="absolute inset-0 w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold block truncate" style={{ color: isUnregistered ? p.faint : p.text }}>
                            {rec.users?.name || t("attendance.unregistered")}
                          </span>
                          {rec.users?.departement && (
                            <span className="text-[11px] font-bold" style={{ color: p.faint }}>{rec.users.departement.toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-xs" style={{ color: p.muted }}>
                      {fmt(rec.punch_time, { day: "2-digit", month: "short", year: "numeric" })}
                    </td>

                    {/* Time — large mono */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-black text-sm" style={{ color: p.text }}>
                        {fmt(rec.punch_time, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>

                    {/* Punch type dot-pill */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${punch.color}15`, color: punch.color }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: punch.color }} />
                        {punch.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm" style={{ color: p.faint }}>
                    {nameFilter
                      ? `No records matching "${nameFilter}"`
                      : `${t("attendance.noRecords")} ${date}. ${t("attendance.trySync")}`}
                  </td>
                </tr>
              )}
            </motion.tbody>
          </table>
        </motion.div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
              <button
                key={pg}
                onClick={() => fetchRecords(pg)}
                className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                style={pg === currentPage
                  ? { background: "#3b6fd4", color: "#fff" }
                  : { background: p.inputBg, color: p.faint, border: `1px solid ${p.border2}` }
                }
              >
                {pg}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
