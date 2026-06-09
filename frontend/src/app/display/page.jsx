"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import apiBaseUrl from "@/lib/urlEndPoint";

const REFRESH_INTERVAL = 5 * 60 * 1000;

const DARK = {
  pageBg: "#060810",
  headerBg: "rgba(255,255,255,0.02)",
  headerBorder: "rgba(255,255,255,0.05)",
  divider: "rgba(255,255,255,0.04)",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.05)",
  barBg: "rgba(255,255,255,0.06)",
  text: "#ffffff",
  muted: "#4a5568",
  ambientBlue: "rgba(59,111,212,0.06)",
  ambientGold: "rgba(245,158,11,0.03)",
  clockColon: "#3b6fd4",
  clockSec: "rgba(255,255,255,0.35)",
  clockSecColon: "rgba(255,255,255,0.2)",
  progressTrack: "rgba(255,255,255,0.06)",
};

const LIGHT = {
  pageBg: "#f0f2f7",
  headerBg: "rgba(255,255,255,0.9)",
  headerBorder: "rgba(0,0,0,0.07)",
  divider: "rgba(0,0,0,0.06)",
  cardBg: "rgba(255,255,255,0.85)",
  cardBorder: "rgba(0,0,0,0.07)",
  barBg: "rgba(0,0,0,0.07)",
  text: "#1a2035",
  muted: "#64748b",
  ambientBlue: "rgba(59,111,212,0.04)",
  ambientGold: "rgba(245,158,11,0.02)",
  clockColon: "#3b6fd4",
  clockSec: "rgba(26,32,53,0.35)",
  clockSecColon: "rgba(26,32,53,0.2)",
  progressTrack: "rgba(0,0,0,0.08)",
};

function useRefreshCountdown(intervalMs) {
  const [secs, setSecs] = useState(Math.floor(intervalMs / 1000));
  useEffect(() => {
    setSecs(Math.floor(intervalMs / 1000));
    const id = setInterval(() => {
      setSecs(s => (s <= 1 ? Math.floor(intervalMs / 1000) : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [intervalMs]);
  return secs;
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

const RANK_META = [
  { color: "#ef4444", glow: "rgba(239,68,68,0.18)", label: "#1" },
  { color: "#f97316", glow: "rgba(249,115,22,0.12)", label: "#2" },
  { color: "#f59e0b", glow: "rgba(245,158,11,0.12)", label: "#3" },
];

function useClock() {
  const [time, setTime] = useState({ h: "00", m: "00", s: "00" });
  const [date, setDate] = useState("");
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime({ h: String(n.getHours()).padStart(2,"0"), m: String(n.getMinutes()).padStart(2,"0"), s: String(n.getSeconds()).padStart(2,"0") });
      setDate(n.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { time, date };
}

function AnimCounter({ to }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!to) return;
    let start = 0;
    const step = to / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= to) { if (ref.current) ref.current.textContent = to; clearInterval(id); }
      else if (ref.current) ref.current.textContent = Math.round(start);
    }, 22);
    return () => clearInterval(id);
  }, [to]);
  return <span ref={ref}>0</span>;
}

function SpotlightCard({ emp, rank = 1, C }) {
  const meta  = RANK_META[rank - 1] || RANK_META[0];
  const score = emp.combined_score ?? 0;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      key={emp.user_id}
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl flex flex-col overflow-hidden"
      style={{
        background: C.cardBg,
        border: `1.5px solid ${meta.color}28`,
        boxShadow: `0 0 60px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        flex: 1,
      }}
    >
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${meta.color}22 0%, transparent 70%)` }} />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(59,111,212,0.08) 0%, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col h-full p-8">
        <div className="flex items-center justify-between mb-auto">
          <span className="font-black tracking-tight" style={{ color: meta.color, fontSize: "clamp(3rem, 6vw, 5rem)", lineHeight: 1 }}>
            {meta.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444", animation: "glow-pulse 2s ease-in-out infinite" }} />
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#ef4444" }}>Live</span>
          </div>
        </div>

        <div className="mt-8 mb-6">
          <div className="relative mb-5" style={{ width: 100, height: 100 }}>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 0 3px ${meta.color}50, 0 0 32px ${meta.color}30` }}
              animate={{ boxShadow: [`0 0 0 3px ${meta.color}50, 0 0 24px ${meta.color}22`, `0 0 0 5px ${meta.color}80, 0 0 48px ${meta.color}44`, `0 0 0 3px ${meta.color}50, 0 0 24px ${meta.color}22`] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative w-full h-full rounded-full overflow-hidden" style={{ background: deptColor(emp.departement), boxShadow: `0 0 0 3px ${color}40` }}>
              <div className="absolute inset-0 flex items-center justify-center font-black text-white" style={{ fontSize: "2.6rem" }}>
                {(emp.name || "?")[0].toUpperCase()}
              </div>
              {emp.link_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
          </div>
          <h2 className="font-black leading-tight mb-2" style={{ color: C.text, fontSize: "clamp(1.6rem, 3.2vw, 2.8rem)" }}>
            {emp.name}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: `${deptColor(emp.departement)}22`, color: deptColor(emp.departement) }}>
              {emp.departement?.toUpperCase() || "—"}
            </span>
            <span className="text-xs font-mono" style={{ color: C.muted }}>{emp.nik}</span>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.muted }}>Kehadiran</p>
            <p className="font-black text-2xl" style={{ color: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}>
              {emp.attendance_rate}%
            </p>
          </div>
          <div className="w-px self-stretch" style={{ background: C.barBg }} />
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.muted }}>Performa</p>
            <p className="font-black text-2xl" style={{ color: "#5b8df8" }}>{emp.performance_status?.toUpperCase() || "—"}</p>
          </div>
          <div className="w-px self-stretch" style={{ background: C.barBg }} />
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.muted }}>Skor</p>
            <p className="font-black text-2xl" style={{ color }}>
              <AnimCounter to={score} />
            </p>
          </div>
        </div>

        <div className="rounded-full overflow-hidden" style={{ background: C.barBg, height: 6 }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function RankRow({ emp, rank, index, C }) {
  const meta  = rank <= 3 ? RANK_META[rank - 1] : null;
  const score = emp.combined_score ?? 0;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.045, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center gap-4 pl-5 pr-4 py-3.5 rounded-2xl transition-all duration-200 overflow-hidden"
      style={{
        background: meta ? `${meta.color}08` : C.cardBg,
        border: `1px solid ${meta ? `${meta.color}18` : C.cardBorder}`,
        boxShadow: meta && rank === 1 ? `inset 4px 0 0 ${meta.color}` : meta ? `inset 3px 0 0 ${meta.color}50` : undefined,
      }}
    >
      <div className="w-8 shrink-0 text-center">
        {meta ? (
          <span className="text-sm font-black" style={{ color: meta.color }}>{rank}</span>
        ) : (
          <span className="text-sm font-bold" style={{ color: C.muted }}>#{rank}</span>
        )}
      </div>

      <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0" style={{ background: deptColor(emp.departement) }}>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
          {(emp.name || "?")[0].toUpperCase()}
        </div>
        {emp.link_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-black truncate" style={{ fontSize: "0.95rem", color: C.text }}>{emp.name}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: C.muted }}>
          {emp.departement} · {emp.nik}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: C.barBg }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.045 + 0.3 }}
          />
        </div>
        <span className="font-black tabular-nums w-8 text-right" style={{ color, fontSize: "1rem" }}>{score}</span>
      </div>
    </motion.div>
  );
}

export default function Display() {
  const { time, date } = useClock();
  const refreshIn = useRefreshCountdown(REFRESH_INTERVAL);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data,  setData]  = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("gas-display-theme");
    if (saved === "light") setIsDark(false);
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("gas-display-theme", next ? "dark" : "light");
      return next;
    });
  };

  const C = isDark ? DARK : LIGHT;

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`);
      const json = await res.json();
      setData(json.data || []);
      setLoaded(true);
    } catch (err) { console.error(err); }
  }, [month]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const sorted  = [...data].reverse();
  const leader   = sorted[0] || null;
  const runner1  = sorted[1] || null;
  const runner2  = sorted[2] || null;
  const restList = sorted.slice(3);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: C.pageBg, fontFamily: "var(--font-geist, Geist, system-ui, sans-serif)", userSelect: "none", transition: "background 0.3s" }}
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 70% 50% at 30% 50%, ${C.ambientBlue} 0%, transparent 70%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 60% at 80% 20%, ${C.ambientGold} 0%, transparent 60%)` }} />

      {/* ---- HEADER BAR ---- */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4 shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.headerBorder}` }}>

        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ boxShadow: "0 0 20px rgba(59,111,212,0.4)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="PT GAS" style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          </div>
          <div>
            <p className="text-sm font-black tracking-widest uppercase" style={{ color: C.text }}>PT. Global Anugerah Setia</p>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: C.muted }}>Papan Peringkat Kinerja SDM</p>
          </div>
        </div>

        <div className="flex items-end gap-0 tabular-nums" style={{ fontFamily: "var(--font-geist-mono, monospace)", lineHeight: 1 }}>
          <span className="font-black" style={{ color: C.text, fontSize: "3.2rem" }}>{time.h}</span>
          <span className="font-black pb-1" style={{ color: C.clockColon, fontSize: "2.6rem" }}>:</span>
          <span className="font-black" style={{ color: C.text, fontSize: "3.2rem" }}>{time.m}</span>
          <span className="font-black pb-1" style={{ color: C.clockSecColon, fontSize: "2.6rem" }}>:</span>
          <span className="font-black" style={{ color: C.clockSec, fontSize: "3.2rem" }}>{time.s}</span>
        </div>

        <div className="flex items-end gap-4">
          <div className="text-right flex flex-col items-end gap-1.5">
            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: "rgba(91,141,248,0.12)", color: "#5b8df8" }}>
              {monthLabel}
            </span>
            <p className="text-[11px] capitalize font-semibold" style={{ color: C.muted }}>{date}</p>
            <div className="flex items-center gap-1.5">
              <div className="relative w-16 h-0.5 rounded-full overflow-hidden" style={{ background: C.progressTrack }}>
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{ background: "#5b8df8", width: `${(refreshIn / (REFRESH_INTERVAL / 1000)) * 100}%` }}
                  transition={{ duration: 0.9, ease: "linear" }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: C.muted }}>
                {Math.floor(refreshIn / 60)}:{String(refreshIn % 60).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200"
            style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, color: C.muted }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* ---- MAIN CONTENT ---- */}
      <div className="relative z-10 flex-1 flex gap-0 overflow-hidden">

        {/* LEFT — Spotlight podium */}
        <div className="flex flex-col gap-3 p-6 overflow-hidden" style={{ width: "38%", borderRight: `1px solid ${C.divider}` }}>
          <p className="text-[10px] font-black tracking-[0.28em] uppercase mb-1" style={{ color: "#ef4444" }}>
            Perlu Perhatian
          </p>

          <AnimatePresence mode="wait">
            {loaded && leader ? (
              <SpotlightCard key={`leader-${leader.user_id}`} emp={leader} rank={1} C={C} />
            ) : loaded ? (
              <motion.div key="no-leader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center" style={{ color: C.muted, fontSize: "0.875rem" }}>
                Belum ada data untuk bulan ini
              </motion.div>
            ) : null}
          </AnimatePresence>

          {(runner1 || runner2) && (
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {[runner1, runner2].map((emp, idx) => {
                if (!emp) return <div key={idx} />;
                const meta  = RANK_META[idx + 1];
                const score = emp.combined_score ?? 0;
                const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
                return (
                  <motion.div
                    key={emp.user_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-2xl p-4"
                    style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-black" style={{ color: meta.color }}>{meta.label}</span>
                      <div className="relative w-9 h-9 rounded-xl overflow-hidden" style={{ background: deptColor(emp.departement) }}>
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        {emp.link_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>
                    </div>
                    <p className="font-black text-sm truncate leading-tight" style={{ color: C.text }}>{emp.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3 truncate" style={{ color: C.muted }}>{emp.departement}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.barBg }}>
                        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, delay: 0.4 + idx * 0.1 }} />
                      </div>
                      <span className="font-black text-sm shrink-0" style={{ color }}>{score}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Full leaderboard */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <p className="text-[10px] font-black tracking-[0.28em] uppercase mb-3 shrink-0" style={{ color: "#ef4444" }}>
            Semua Peringkat Bawah
          </p>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
            <AnimatePresence>
              {sorted.map((emp, i) => (
                <RankRow key={emp.user_id} emp={emp} rank={i + 1} index={i} C={C} />
              ))}
            </AnimatePresence>
            {loaded && sorted.length === 0 && (
              <div className="flex-1 flex items-center justify-center" style={{ color: C.muted, fontSize: "0.875rem" }}>
                Belum ada data untuk bulan ini
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- BOTTOM TICKER ---- */}
      <div className="relative z-10 overflow-hidden shrink-0" style={{ background: "#3b6fd4", height: 36 }}>
        <div className="flex items-center h-full whitespace-nowrap" style={{ animation: "ticker 50s linear infinite" }}>
          {[1, 2, 3, 4].map(n => (
            <span key={n} className="text-[11px] font-black tracking-widest uppercase text-white px-10">
              GROW ACHIEVE SUCCESS
              <span className="mx-8 opacity-50">·</span>
              PT. GLOBAL ANUGERAH SETIA INDONESIA
              <span className="mx-8 opacity-50">·</span>
              PAPAN PERINGKAT KINERJA SDM
              <span className="mx-8 opacity-50">·</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-25%); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
          50%       { opacity: 0.4; box-shadow: 0 0 3px #22c55e; }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
