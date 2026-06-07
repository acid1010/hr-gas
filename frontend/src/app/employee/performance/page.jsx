"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import Drawer from "@/app/components/Drawer";
import { Plus, Trash2, TrendingUp, Users, Award, ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";

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
      if (ref.current) ref.current.textContent = Math.round(from + (to - from) * ease);
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
  const [statusFilter,  setStatusFilter]  = useState("");
  const [perfNameFilter, setPerfNameFilter] = useState("");

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
      toast(t("performance.saveRecord") + " — OK");
      e.target.reset();
      setDrawerOpen(false);
      loadLeaderboard();
      loadPerf();
    } catch (err) { toast(err.message, "error"); }
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
  const filteredPerf = perfRecords.filter(r => {
    if (statusFilter && (r.status || "").toLowerCase() !== statusFilter) return false;
    if (perfNameFilter.trim()) {
      const q = perfNameFilter.toLowerCase();
      return (r.users?.name || "").toLowerCase().includes(q) ||
             String(r.users?.nik || "").includes(q);
    }
    return true;
  });

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

        {/* KPI STRIP — performance distribution */}
        {leaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="grid grid-cols-4 gap-3 mb-5"
          >
            {[
              { key: "best",    label: "Best",    color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.18)"   },
              { key: "good",    label: "Good",    color: "#5b8df8", bg: "rgba(91,141,248,0.08)",  border: "rgba(91,141,248,0.18)"  },
              { key: "average", label: "Average", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)"  },
              { key: "worst",   label: "Worst",   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"   },
            ].map(({ key, label, color, bg, border }, i) => {
              const count = leaderboard.filter(e => (e.performance_status || "").toLowerCase() === key).length;
              const pct   = leaderboard.length ? Math.round((count / leaderboard.length) * 100) : 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl px-5 py-4 flex items-center justify-between transition-colors duration-300"
                  style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color }}>{label}</span>
                    </div>
                    <span className="text-2xl font-black" style={{ color }}><Counter to={count} /></span>
                    <span className="text-xs font-bold ml-1.5" style={{ color: p.faint }}><Counter to={pct} />%</span>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}` }}>
                    <span className="text-xs font-black" style={{ color }}>{pct}%</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* TAB SWITCHER — framer-motion spring pill */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex gap-0.5 mb-5 p-1 rounded-xl w-fit relative"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPerfNameFilter(""); setStatusFilter(""); }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold z-10 transition-colors duration-150"
              style={{ color: tab === key ? "#5b8df8" : p.muted }}
            >
              {tab === key && (
                <motion.div
                  layoutId="perf-tab-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "#1e2d52" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={14} className="relative z-10" />
              <span className="relative z-10">{label}</span>
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
            >
            {/* PODIUM — top 3 visual */}
            {sorted.length >= 3 && (
              <div className="flex items-end justify-center gap-2 mb-5">
                {[sorted[1], sorted[0], sorted[2]].map((emp, podIdx) => {
                  const rank    = podIdx === 0 ? 2 : podIdx === 1 ? 1 : 3;
                  const color   = RANK_COLORS[rank - 1];
                  const score   = emp?.combined_score ?? 0;
                  const avatarSize = rank === 1 ? "w-16 h-16" : "w-11 h-11";
                  const podHeight = rank === 1 ? 174 : 136;
                  if (!emp) return <div key={podIdx} style={{ flex: 1 }} />;
                  return (
                    <motion.div
                      key={emp.user_id}
                      initial={{ opacity: 0, y: rank === 1 ? 28 : 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: podIdx * 0.1 + 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 flex flex-col items-center rounded-2xl px-3 pb-4 pt-5 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(160deg, ${color}12 0%, ${color}06 100%)`,
                        border: `1px solid ${color}${rank === 1 ? "35" : "22"}`,
                        minHeight: podHeight,
                        boxShadow: rank === 1 ? `0 0 40px ${color}20` : undefined,
                      }}
                    >
                      {/* Ambient glow spot */}
                      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}14, transparent 70%)` }} />

                      {/* Rank number — large, top */}
                      <span
                        className="font-black leading-none mb-3 tabular-nums"
                        style={{ color, fontSize: rank === 1 ? "2rem" : "1.4rem", textShadow: rank === 1 ? `0 0 24px ${color}60` : undefined }}
                      >
                        #{rank}
                      </span>

                      {/* Avatar */}
                      <div
                        className={`relative ${avatarSize} rounded-full overflow-hidden mb-2.5 shrink-0`}
                        style={{ background: deptColor(emp.departement), boxShadow: `0 0 0 2.5px ${p.cardBg}, 0 0 0 4px ${color}50` }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center font-black text-white" style={{ fontSize: rank === 1 ? "1.4rem" : "1rem" }}>
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        {emp.link_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>

                      <p className="font-black text-center leading-tight w-full truncate px-1" style={{ color: rank === 1 ? color : p.text, fontSize: rank === 1 ? "0.85rem" : "0.75rem" }}>{emp.name}</p>

                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md mt-1 mb-auto" style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}>
                        {(emp.departement || "").toUpperCase()}
                      </span>

                      {/* Score badge */}
                      <div className="mt-3 flex flex-col items-center">
                        <span className="font-black tabular-nums" style={{ color, fontSize: rank === 1 ? "1.6rem" : "1.2rem" }}>{score}</span>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: `${color}80` }}>score</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl overflow-hidden transition-colors duration-300"
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
                    const isChamp   = rank === 1;
                    return (
                      <motion.tr
                        key={emp.user_id}
                        custom={i}
                        variants={rowVariants}
                        className="relative transition-colors duration-150"
                        style={{
                          borderBottom: `1px solid ${p.border}`,
                          background: isChamp
                            ? "rgba(245,158,11,0.04)"
                            : i % 2 === 0 ? p.cardBg : p.rowAlt,
                          boxShadow: isChamp ? "inset 3px 0 0 #f59e0b" : undefined,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isChamp ? "rgba(245,158,11,0.08)" : p.rowHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isChamp ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? p.cardBg : p.rowAlt; }}
                      >
                        {/* Rank chip */}
                        <td className="px-5 py-4">
                          {rank <= 3 ? (
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                              style={{
                                background: `${rankColor}18`,
                                color: rankColor,
                                boxShadow: isChamp ? `0 0 12px ${rankColor}44` : undefined,
                              }}
                            >
                              {rank}
                            </span>
                          ) : (
                            <span className="text-sm font-black inline-block w-7 text-center" style={{ color: p.faint }}>#{rank}</span>
                          )}
                        </td>

                        {/* Employee avatar + name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"
                              style={{
                                background: deptColor(emp.departement),
                                boxShadow: isChamp ? `0 0 0 2px #f59e0b, 0 0 10px rgba(245,158,11,0.3)` : undefined,
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                                {(emp.name || "?")[0].toUpperCase()}
                              </div>
                              {emp.link_image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold truncate" style={{ color: isChamp ? "#f59e0b" : p.text }}>{emp.name}</p>
                              <p className="font-mono text-[11px]" style={{ color: p.faint }}>{emp.nik}</p>
                            </div>
                          </div>
                        </td>

                        {/* Dept chip */}
                        <td className="px-5 py-4">
                          {emp.departement ? (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-md"
                              style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}
                            >
                              {emp.departement.toUpperCase()}
                            </span>
                          ) : <span style={{ color: p.faint }}>—</span>}
                        </td>

                        {/* Attendance % with mini bar */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 min-w-[72px]">
                            <span className="text-sm font-black tabular-nums" style={{ color: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}>
                              {emp.attendance_rate}%
                            </span>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: p.border2, minWidth: 64 }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${emp.attendance_rate}%` }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 + 0.2 }}
                              />
                            </div>
                          </div>
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
            </div>
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
            >
              {/* Status filter chips */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {[
                  { key: "", label: "All" },
                  { key: "best",    label: "Best",    color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
                  { key: "good",    label: "Good",    color: "#5b8df8", bg: "rgba(91,141,248,0.12)" },
                  { key: "average", label: "Average", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
                  { key: "worst",   label: "Worst",   color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
                ].map(opt => {
                  const active = statusFilter === opt.key;
                  const count = opt.key
                    ? perfRecords.filter(r => (r.status || "").toLowerCase() === opt.key).length
                    : perfRecords.length;
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => setStatusFilter(opt.key)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                      style={{
                        background: active ? (opt.bg || p.inputBg) : p.inputBg,
                        color:      active ? (opt.color || p.text) : p.muted,
                        border:     `1px solid ${active ? (opt.color || p.border) + "55" : p.border}`,
                        boxShadow:  active && opt.color ? `0 0 0 2px ${opt.color}22` : "none",
                      }}
                    >
                      {opt.key && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />}
                      {opt.label}
                      <span className="ml-0.5 tabular-nums text-[10px] opacity-70">{count}</span>
                    </motion.button>
                  );
                })}
                {/* Name search */}
                <div className="relative ml-auto">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
                  <input
                    type="text"
                    placeholder="Search name / NIK…"
                    value={perfNameFilter}
                    onChange={e => setPerfNameFilter(e.target.value)}
                    className="pl-8 pr-4 py-1.5 rounded-xl text-xs outline-none transition-all w-44"
                    style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
                    onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
                    onBlur={e =>  { e.target.style.borderColor = p.border2; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                {(statusFilter || perfNameFilter) && (
                  <span className="text-xs" style={{ color: p.faint }}>
                    {filteredPerf.length} / {perfRecords.length}
                  </span>
                )}
              </div>

              <div className="rounded-2xl overflow-hidden transition-colors duration-300"
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
                  {filteredPerf.length > 0 ? filteredPerf.map((item, i) => (
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* DRAWER */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t("performance.addTitle")} subtitle="Record quarterly performance rating" accentColor="#5b8df8">
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
