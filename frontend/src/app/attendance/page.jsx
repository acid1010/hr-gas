"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
const AttendanceChart = dynamic(() => import("./_AttendanceChart"), { ssr: false, loading: () => <div className="h-[148px]" /> });
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { RefreshCw, Wifi, WifiOff, Calendar, Search, FileSpreadsheet, Activity, Users, Clock, Fingerprint, X, CheckCircle, AlertCircle, UserX, UserPlus } from "lucide-react";
import EmployeeForm from "@/app/components/forms/EmployeeForm";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";
import { SkeletonTable } from "@/app/components/SkeletonRow";

const fmt = (ts, opts) => new Date(ts).toLocaleString("id-ID", opts);

function Counter({ to, duration = 1.2 }) {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const t0 = performance.now();
    const ms = duration * 1000;
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      if (ref.current) ref.current.textContent = Math.round(from + (to - from) * ease).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = to;
    };
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <span ref={ref}>0</span>;
}

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
  const [nameFilter,      setNameFilter]      = useState("");
  const [punchTypeFilter, setPunchTypeFilter] = useState(null);
  const [deptFilter,      setDeptFilter]      = useState("");
  const [liveConnected,   setLiveConnected]   = useState(false);
  const [deviceUsersOpen,  setDeviceUsersOpen]  = useState(false);
  const [deviceUsersData,  setDeviceUsersData]  = useState(null);
  const [deviceUsersTab,   setDeviceUsersTab]   = useState("matched");
  const [deviceUsersLoading, setDeviceUsersLoading] = useState(false);
  const [importForm,   setImportForm]   = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const autoSyncRef = useRef(null);
  const dateRef = useRef(date);
  useEffect(() => { dateRef.current = date; }, [date]);

  const punchLabel = (type) => {
    if (type === 0) return { label: "Masuk",  color: "#22c55e" };
    if (type === 1) return { label: "Keluar", color: "#5b8df8" };
    return { label: "-", color: "#6b7a99" };
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

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/attendance/realtime`, { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "status") {
          setLiveConnected(msg.connected);
          if (msg.connected) setDeviceStatus(true);
        } else if (msg.type === "punch") {
          const punchDate = msg.punch_time.slice(0, 10);
          if (punchDate !== dateRef.current) return;
          const newRecord = {
            id: `live-${msg.device_uid}-${msg.punch_time}`,
            device_uid: msg.device_uid,
            punch_time: msg.punch_time,
            punch_type: msg.punch_type,
            user_id: msg.user?.id ?? null,
            users: msg.user,
          };
          setRecords((prev) => [newRecord, ...prev]);
          setTotal((prev) => prev + 1);
          setLastSynced(new Date());
        }
      } catch {}
    };

    es.onerror = () => setLiveConnected(false);

    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDeviceUsers = async () => {
    setDeviceUsersOpen(true);
    setDeviceUsersLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/users`);
      setDeviceUsersData(res);
      setDeviceUsersTab("matched");
    } catch (err) {
      toast(err.message, "error");
      setDeviceUsersOpen(false);
    } finally {
      setDeviceUsersLoading(false);
    }
  };

  const [importAllSaving, setImportAllSaving] = useState(false);

  const importAllFromDevice = async () => {
    if (!deviceUsersData?.unregistered?.length) return;
    setImportAllSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const payload = deviceUsersData.unregistered.map((row) => ({
      nik: row.device.userId || "",
      name: row.device.name || "",
      join_date: today,
      status: "aktif",
    }));
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast(`${res.created} pegawai ditambahkan${res.skipped ? `, ${res.skipped} dilewati` : ""}`, "success");
      const fresh = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/users`);
      setDeviceUsersData(fresh);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setImportAllSaving(false);
    }
  };

  const openImportForm = (deviceUser) => {
    setImportForm({
      nik: deviceUser.userId || "",
      name: deviceUser.name || "",
      join_date: new Date().toISOString().slice(0, 10),
      status: "aktif",
      departement: "",
      section: "",
      worker_stats: "",
      shift_id: "",
      link_image: "",
    });
  };

  const saveImportForm = async () => {
    if (!importForm?.nik || !importForm?.name) {
      toast("NIK dan nama wajib diisi", "error");
      return;
    }
    setImportSaving(true);
    try {
      await fetchWithAuth(`${apiBaseUrl}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(importForm) });
      toast(`${importForm.name} berhasil ditambahkan`, "success");
      setImportForm(null);
      // Refresh device users list to move row out of unregistered
      const res = await fetchWithAuth(`${apiBaseUrl}/api/attendance/device/users`);
      setDeviceUsersData(res);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setImportSaving(false);
    }
  };

  const filteredRecords = records.filter(r => {
    if (punchTypeFilter !== null && r.punch_type !== punchTypeFilter) return false;
    if (deptFilter && (r.users?.departement || "").toLowerCase() !== deptFilter) return false;
    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase();
      return (r.users?.name || "").toLowerCase().includes(q) ||
             String(r.users?.nik || r.device_uid || "").includes(q);
    }
    return true;
  });

  // Departments present in current records page (for filter chips)
  const activeDepts = [...new Set(records.filter(r => r.users?.departement).map(r => r.users.departement.toLowerCase()))].sort();

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
    <>
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* HEADER */}
        <div
          className="fade-up mb-8 flex items-end justify-between gap-6 flex-wrap"
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

            {liveConnected && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black" style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22c55e" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22c55e" }} />
                </span>
                LIVE
              </div>
            )}

            <button
              onClick={() => doSync(false)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: syncing ? "#1e2d52" : "#3b6fd4", cursor: syncing ? "not-allowed" : "pointer" }}
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? t("attendance.syncing") : t("attendance.syncDevice")}
            </button>
          </div>
        </div>


        {/* STAT CHIPS — 4×1 bento, zero gaps */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          {statItems.map(({ label, value, accent, Icon, isText }, i) => (
            <div
              key={label}
              className="fade-up rounded-2xl p-5 flex items-center gap-4 transition-colors duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: `${i * 0.07}s` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
                <Icon size={17} style={{ color: accent }} />
              </div>
              <div className="min-w-0">
                <p className={`font-black leading-none truncate ${isText ? "text-xl" : "text-2xl"}`} style={{ color: accent }}>
                  {isText ? value : <Counter to={typeof value === "number" ? value : 0} />}
                </p>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase mt-1 truncate" style={{ color: p.faint }}>
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* BAR CHART */}
        <div
          className="fade-up rounded-2xl mb-5 overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.22s" }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.border}` }}>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>{t("attendance.punchesByHour")}</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded-full" style={{ background: "#5b8df8" }} />
              <span className="text-[10px] font-bold" style={{ color: p.faint }}>punches / hr</span>
            </div>
          </div>
          <div className="px-6 py-5">
            <AttendanceChart data={hourlyData} />
          </div>
        </div>

        {/* TOOLBAR */}
        <div
          className="fade-up mb-4 flex flex-wrap items-center gap-3 justify-between p-4 rounded-2xl transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.28s" }}
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
            <button
              onClick={() => fetchRecords(1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: "#3b6fd4" }}
            >
              <Search size={14} /> {t("common.filter")}
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = p.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border2; e.currentTarget.style.color = p.muted; }}
            >
              <FileSpreadsheet size={14} /> {t("attendance.monthlyReport")}
            </button>
            <button
              onClick={openDeviceUsers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = p.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border2; e.currentTarget.style.color = p.muted; }}
            >
              <Fingerprint size={14} /> Pegawai Perangkat
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 w-full xl:mt-0 xl:w-auto xl:ml-auto flex-wrap">
            {/* Punch type chips */}
            {[
              { key: null,  label: "All",       color: p.muted,   bg: p.inputBg },
              { key: 0,     label: "Masuk",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
              { key: 1,     label: "Keluar", color: "#5b8df8", bg: "rgba(91,141,248,0.12)" },
            ].map(opt => {
              const active = punchTypeFilter === opt.key;
              return (
                <button
                  key={String(opt.key)}
                  onClick={() => setPunchTypeFilter(opt.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                  style={{
                    background: active ? opt.bg : p.inputBg,
                    color:      active ? opt.color : p.faint,
                    border:     `1px solid ${active && opt.key !== null ? opt.color + "55" : p.border}`,
                  }}
                >
                  {opt.key !== null && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />}
                  {opt.label}
                </button>
              );
            })}

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
              <input
                type="text"
                placeholder={t("attendance.filterName") || "Filter by name / NIK…"}
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-xl text-sm outline-none transition-all w-48"
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
        </div>

        {/* DEPT FILTER CHIPS */}
        {activeDepts.length > 1 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[10px] font-black tracking-[0.15em] uppercase mr-1" style={{ color: p.faint }}>Dept</span>
            {[{ key: "", label: "All" }, ...activeDepts.map(d => ({ key: d, label: d.toUpperCase() }))].map(opt => {
              const active = deptFilter === opt.key;
              const color  = opt.key ? deptColor(opt.key) : p.muted;
              return (
                <button
                  key={opt.key}
                  onClick={() => setDeptFilter(opt.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black transition-all duration-200"
                  style={{
                    background: active ? `${color}22` : p.inputBg,
                    color:      active ? color : p.faint,
                    border:     `1px solid ${active && opt.key ? color + "55" : p.border}`,
                  }}
                >
                  {opt.key && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* TABLE */}
        <div
          className="fade-up rounded-2xl overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.34s" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                {[t("attendance.columns.nik"), t("attendance.columns.name"), t("attendance.columns.date"), t("attendance.columns.time"), t("attendance.columns.type")].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTable rows={10} cols={5} />
              ) : filteredRecords.length > 0 ? filteredRecords.map((rec, i) => {
                const punch         = punchLabel(rec.punch_type);
                const isUnregistered = !rec.user_id;
                return (
                  <tr
                    key={rec.id}
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
                            <span
                              className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                              style={{ background: `${deptColor(rec.users.departement)}18`, color: deptColor(rec.users.departement) }}
                            >
                              {rec.users.departement.toUpperCase()}
                            </span>
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
                  </tr>
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
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {/* Prev */}
            <button
              onClick={() => fetchRecords(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all"
              style={{
                background: p.inputBg,
                border: `1px solid ${p.border2}`,
                color: currentPage === 1 ? p.faint : p.muted,
                opacity: currentPage === 1 ? 0.35 : 1,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.borderColor = "rgba(91,141,248,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border2; }}
            >
              ‹
            </button>

            {/* Smart pages with ellipsis */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(pg => pg === 1 || pg === totalPages || Math.abs(pg - currentPage) <= 1)
              .reduce((acc, pg, idx, arr) => {
                if (idx > 0 && pg - arr[idx - 1] > 1) acc.push("…");
                acc.push(pg);
                return acc;
              }, [])
              .map((pg, idx) =>
                pg === "…" ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: p.faint }}>…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => fetchRecords(pg)}
                    className="relative w-8 h-8 rounded-xl text-xs font-bold transition-colors"
                    style={{
                      background: pg === currentPage ? "#3b6fd4" : p.inputBg,
                      color:      pg === currentPage ? "#fff"    : p.faint,
                      border:     `1px solid ${pg === currentPage ? "#3b6fd4" : p.border2}`,
                    }}
                  >
                    {pg}
                  </button>
                )
              )}

            {/* Next */}
            <button
              onClick={() => fetchRecords(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all"
              style={{
                background: p.inputBg,
                border: `1px solid ${p.border2}`,
                color: currentPage === totalPages ? p.faint : p.muted,
                opacity: currentPage === totalPages ? 0.35 : 1,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.borderColor = "rgba(91,141,248,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border2; }}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </main>

    {/* DEVICE USERS DRAWER */}
    {deviceUsersOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setDeviceUsersOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden w-full max-w-2xl"
            style={{ background: p.cardBg, borderLeft: `1px solid ${p.border}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${p.border}` }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.primary }}>Perangkat Sidik Jari</p>
                <h2 className="mt-1 text-lg font-black" style={{ color: p.text }}>Data Pegawai Terdaftar</h2>
              </div>
              <button onClick={() => setDeviceUsersOpen(false)} className="rounded-xl p-2 transition" style={{ color: p.muted }} onMouseEnter={e => e.currentTarget.style.color = p.text} onMouseLeave={e => e.currentTarget.style.color = p.muted}>
                <X size={18} />
              </button>
            </div>

            {deviceUsersLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-sm font-bold animate-pulse" style={{ color: p.muted }}>Menghubungi perangkat…</div>
              </div>
            ) : deviceUsersData ? (
              <>
                {/* Summary chips */}
                <div className="grid grid-cols-3 gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${p.border}` }}>
                  {[
                    { label: "Cocok", count: deviceUsersData.matched.length,      icon: CheckCircle, color: "#22c55e" },
                    { label: "Tidak di DB",  count: deviceUsersData.unregistered.length, icon: AlertCircle, color: "#f59e0b" },
                    { label: "Tidak di Perangkat",  count: deviceUsersData.notOnDevice.length,  icon: UserX,       color: "#ef4444" },
                  ].map(({ label, count, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                      <Icon size={16} style={{ color }} />
                      <div>
                        <p className="text-xl font-black leading-none" style={{ color }}>{count}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color }}>{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabs + bulk action */}
                <div className="flex items-center justify-between gap-2 px-6 pt-4 pb-2">
                <div className="flex gap-1">
                  {[
                    { key: "matched",      label: `Cocok (${deviceUsersData.matched.length})` },
                    { key: "unregistered", label: `Tidak di DB (${deviceUsersData.unregistered.length})` },
                    { key: "notOnDevice",  label: `Tidak di Perangkat (${deviceUsersData.notOnDevice.length})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setDeviceUsersTab(tab.key)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                      style={{
                        background: deviceUsersTab === tab.key ? "#3b6fd4" : p.inputBg,
                        color: deviceUsersTab === tab.key ? "#fff" : p.faint,
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {deviceUsersTab === "unregistered" && deviceUsersData.unregistered.length > 0 && (
                  <button
                    onClick={importAllFromDevice}
                    disabled={importAllSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all"
                    style={{ background: importAllSaving ? p.inputBg : "#3b6fd4", color: "#fff", cursor: importAllSaving ? "not-allowed" : "pointer" }}
                  >
                    {importAllSaving
                      ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Menyimpan…</>
                      : <><UserPlus size={12} /> Tambah Semua ({deviceUsersData.unregistered.length})</>}
                  </button>
                )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: "none" }}>
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                        {deviceUsersTab === "matched" && (
                          <>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>NIK / UID</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Nama (Perangkat)</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Nama (DB)</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Departemen</th>
                          </>
                        )}
                        {deviceUsersTab === "unregistered" && (
                          <>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>UID Perangkat</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Nama (Perangkat)</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>User ID</th>
                            <th />
                          </>
                        )}
                        {deviceUsersTab === "notOnDevice" && (
                          <>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>NIK</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Nama</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Departemen</th>
                            <th className="py-3 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: p.faint }}>Jabatan</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {deviceUsersTab === "matched" && deviceUsersData.matched.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${p.border}` }}>
                          <td className="py-3"><span className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>{row.db.nik}</span></td>
                          <td className="py-3 text-xs" style={{ color: p.muted }}>{row.device.name || "—"}</td>
                          <td className="py-3 text-xs font-semibold" style={{ color: p.text }}>{row.db.name}</td>
                          <td className="py-3 text-xs" style={{ color: p.muted }}>{row.db.departement || "—"}</td>
                        </tr>
                      ))}
                      {deviceUsersTab === "unregistered" && deviceUsersData.unregistered.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${p.border}` }}>
                          <td className="py-3"><span className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>{row.device.uid}</span></td>
                          <td className="py-3 text-xs font-semibold" style={{ color: p.text }}>{row.device.name || "—"}</td>
                          <td className="py-3 text-xs" style={{ color: p.muted }}>{row.device.userId || "—"}</td>
                          <td className="py-3">
                            <button
                              onClick={() => openImportForm(row.device)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                              style={{ background: "rgba(91,141,248,0.12)", color: "#5b8df8", border: "1px solid rgba(91,141,248,0.25)" }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(91,141,248,0.22)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(91,141,248,0.12)"}
                            >
                              <UserPlus size={12} /> Tambah
                            </button>
                          </td>
                        </tr>
                      ))}
                      {deviceUsersTab === "notOnDevice" && deviceUsersData.notOnDevice.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${p.border}` }}>
                          <td className="py-3"><span className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{String(row.db.nik)}</span></td>
                          <td className="py-3 text-xs font-semibold" style={{ color: p.text }}>{row.db.name}</td>
                          <td className="py-3 text-xs" style={{ color: p.muted }}>{row.db.departement || "—"}</td>
                          <td className="py-3 text-xs" style={{ color: p.muted }}>{row.db.section || "—"}</td>
                        </tr>
                      ))}
                      {deviceUsersData[deviceUsersTab]?.length === 0 && (
                        <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: p.faint }}>Tidak ada data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </aside>
        </>
      )}

    {/* IMPORT FROM DEVICE MODAL */}
    {importForm && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 60, background: "rgba(0,0,0,0.55)" }}
            onClick={() => !importSaving && setImportForm(null)}
          />
          <div
            className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-3xl overflow-hidden"
            style={{ background: p.cardBg, border: `1px solid ${p.border}`, maxHeight: "90vh", zIndex: 61 }}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${p.border}` }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.primary }}>Dari Perangkat Sidik Jari</p>
                <h2 className="mt-1 text-base font-black" style={{ color: p.text }}>Tambah Pegawai ke Database</h2>
              </div>
              <button disabled={importSaving} onClick={() => setImportForm(null)} className="rounded-xl p-2" style={{ color: p.muted }}>
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "none" }}>
              <EmployeeForm
                formData={importForm}
                onChange={(field, value) => setImportForm((prev) => ({ ...prev, [field]: value }))}
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${p.border}` }}>
              <button
                disabled={importSaving}
                onClick={() => setImportForm(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: p.inputBg, color: p.muted }}
              >
                Batal
              </button>
              <button
                disabled={importSaving}
                onClick={saveImportForm}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: importSaving ? "#1e2d52" : "#3b6fd4", cursor: importSaving ? "not-allowed" : "pointer" }}
              >
                {importSaving ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Menyimpan…</> : <><UserPlus size={14} /> Simpan Pegawai</>}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
