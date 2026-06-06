"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import Drawer from "@/app/components/Drawer";
import { Plus, Trash2, TrendingUp, Users, Award, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";

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
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400` : url;
}

const PERF_STYLE = {
  best:    { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", dot: "#22c55e" },
  good:    { bg: "rgba(91,141,248,0.12)", color: "#5b8df8", dot: "#5b8df8" },
  average: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", dot: "#f59e0b" },
  worst:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", dot: "#ef4444" },
};

function PerfBadge({ value }) {
  const s = PERF_STYLE[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.1)", color: "#6b7a99", dot: "#6b7a99" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {value?.toUpperCase() || "—"}
    </span>
  );
}

function ScoreBar({ score, barBg }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <span className="text-base font-black tabular-nums w-8 shrink-0" style={{ color }}>{score}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: barBg, minWidth: 80 }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </div>
    </div>
  );
}

function DeleteButton({ label, confirmLabel, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <motion.button
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        onClick={() => { setConfirming(false); onConfirm(); }}
        onMouseLeave={() => setConfirming(false)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-black text-white"
        style={{ background: "#ef4444" }}
      >
        {confirmLabel}
      </motion.button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
    >
      <Trash2 size={13} />
    </button>
  );
}

const rowVariants = {
  hidden:  { opacity: 0, y: 5 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.032, duration: 0.32, ease: [0.22, 1, 0.36, 1] } }),
};

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

export default function Performance() {
  const { t, p } = useAppSettings();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month,       setMonth]       = useState(defaultMonth);
  const [leaderboard, setLeaderboard] = useState([]);
  const [perfRecords, setPerfRecords] = useState([]);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [sortKey,     setSortKey]     = useState("combined_score");
  const [sortDir,     setSortDir]     = useState(-1);
  const [tab,         setTab]         = useState("leaderboard");

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
      toast(t("common.delete") + " — OK");
      loadLeaderboard();
      loadPerf();
    } catch (err) { toast(err.message, "error"); }
  };

  const sort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const sorted = [...leaderboard].sort((a, b) => sortDir * (b[sortKey] - a[sortKey]));

  const SortTh = ({ k, children }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === -1 ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th
        className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase cursor-pointer select-none"
        style={{ color: active ? "#5b8df8" : p.faint }}
        onClick={() => sort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <Icon size={10} style={{ opacity: active ? 1 : 0.45 }} />
        </span>
      </th>
    );
  };

  const tabs = [
    { key: "leaderboard", label: t("performance.leaderboard"), Icon: Award },
    { key: "records",     label: t("performance.records"),     Icon: TrendingUp },
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
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1.5" style={{ color: p.primary }}>
                {t("performance.subtitle")}
              </p>
              <h1 className="text-[2rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
                {t("performance.title")}
              </h1>
            </div>
            {leaderboard.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-0.5" style={{ background: `${p.primary}14`, color: p.primary }}>
                <Users size={12} /> {leaderboard.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text, colorScheme: "dark" }}
              onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
              onBlur={e =>  { e.target.style.borderColor = p.border2;  e.target.style.boxShadow = "none"; }}
            />
            <motion.button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: "#3b6fd4" }}
              whileHover={{ scale: 1.02, backgroundColor: "#2f5cb8" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Plus size={15} /> {t("performance.addRecord")}
            </motion.button>
          </div>
        </motion.div>

        {/* TAB SWITCHER */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200"
              style={tab === key
                ? { background: "#1e2d52", color: "#5b8df8" }
                : { color: p.muted }
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </motion.div>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">

          {/* LEADERBOARD TAB */}
          {tab === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl overflow-hidden transition-colors duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.rank")}</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.employee")}</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.department")}</th>
                    <SortTh k="attendance_rate">{t("performance.columns.attendance")}</SortTh>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.perfRating")}</th>
                    <SortTh k="combined_score">{t("performance.columns.combinedScore")}</SortTh>
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.032 } } }}
                >
                  {sorted.length > 0 ? sorted.map((emp, i) => {
                    const rank      = i + 1;
                    const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : p.faint;
                    return (
                      <motion.tr
                        key={emp.user_id}
                        custom={i}
                        variants={rowVariants}
                        className="transition-colors duration-150"
                        style={{ borderBottom: `1px solid ${p.border}`, background: i % 2 === 0 ? p.cardBg : p.rowAlt }}
                        onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; }}
                      >
                        {/* Rank chip */}
                        <td className="px-5 py-4">
                          {rank <= 3 ? (
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${rankColor}18`, color: rankColor }}>
                              {rank}
                            </span>
                          ) : (
                            <span className="text-sm font-black inline-block w-7 text-center" style={{ color: p.faint }}>#{rank}</span>
                          )}
                        </td>

                        {/* Employee avatar + name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(emp.departement) }}>
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                                {(emp.name || "?")[0].toUpperCase()}
                              </div>
                              {emp.link_image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold truncate" style={{ color: p.text }}>{emp.name}</p>
                              <p className="font-mono text-[11px]" style={{ color: p.faint }}>{emp.nik}</p>
                            </div>
                          </div>
                        </td>

                        {/* Dept */}
                        <td className="px-5 py-4">
                          <span className="text-xs font-bold" style={{ color: p.muted }}>{emp.departement?.toUpperCase() || "—"}</span>
                        </td>

                        {/* Attendance % color-coded */}
                        <td className="px-5 py-4">
                          <span className="text-sm font-black" style={{ color: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}>
                            {emp.attendance_rate}%
                          </span>
                        </td>

                        {/* Perf badge */}
                        <td className="px-5 py-4">
                          {emp.performance_status ? <PerfBadge value={emp.performance_status} /> : <span style={{ color: p.faint }}>—</span>}
                        </td>

                        {/* Animated score bar */}
                        <td className="px-5 py-4">
                          <ScoreBar score={emp.combined_score} barBg={p.border2} />
                        </td>
                      </motion.tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                            <Award size={22} style={{ color: p.faint }} />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("performance.noData")} {month}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </motion.tbody>
              </table>
            </motion.div>
          )}

          {/* RECORDS TAB */}
          {tab === "records" && (
            <motion.div
              key="records"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl overflow-hidden transition-colors duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                    {[
                      t("performance.columns.quarter"),
                      t("performance.columns.nik"),
                      t("performance.columns.employee"),
                      t("performance.columns.status"),
                      t("performance.columns.description"),
                      t("performance.columns.action"),
                    ].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.032 } } }}
                >
                  {perfRecords.length > 0 ? perfRecords.map((item, i) => (
                    <motion.tr
                      key={item.id}
                      custom={i}
                      variants={rowVariants}
                      className="group transition-colors duration-150"
                      style={{ borderBottom: `1px solid ${p.border}`, background: i % 2 === 0 ? p.cardBg : p.rowAlt }}
                      onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; }}
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>
                          Q{item.quarter}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>
                          {item.users?.nik}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(item.users?.departement) }}>
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                              {(item.users?.name || "?")[0].toUpperCase()}
                            </div>
                            {item.users?.link_image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getDrivePreview(item.users.link_image)} alt={item.users.name} className="absolute inset-0 w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="font-semibold" style={{ color: p.text }}>{item.users?.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4"><PerfBadge value={item.status} /></td>
                      <td className="px-5 py-4 text-sm max-w-xs truncate" style={{ color: p.muted }}>
                        {item.description || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <DeleteButton
                            label={t("common.delete")}
                            confirmLabel={t("common.confirm")}
                            onConfirm={() => handleDelete(item.id)}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                            <TrendingUp size={22} style={{ color: p.faint }} />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("performance.noRecords")}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </motion.tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* DRAWER */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t("performance.addTitle")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PerformanceForm onSubmit={handleSubmit} />
          <motion.button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-black text-white mt-2"
            style={{ background: "#3b6fd4" }}
            whileHover={{ scale: 1.012, backgroundColor: "#2f5cb8" }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.15 }}
          >
            {t("performance.saveRecord")}
          </motion.button>
        </form>
      </Drawer>
    </main>
  );
}
