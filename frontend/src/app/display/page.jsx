"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiBaseUrl from "@/lib/urlEndPoint";

const REFRESH_INTERVAL = 5 * 60 * 1000;

function useClock() {
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  useEffect(() => {
    const tick = () => {
      setT(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setD(new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { time: t, date: d };
}

function AnimatedScore({ score }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!score) return;
    let start = 0;
    const step = score / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= score) { setDisplay(score); clearInterval(id); }
      else setDisplay(Math.round(start));
    }, 25);
    return () => clearInterval(id);
  }, [score]);
  return <>{display}</>;
}

function RankCard({ rank, emp, variant, index }) {
  const isTop = variant === "top";
  const scoreColor = isTop ? "#22c55e" : "#ef4444";
  const rankColor = isTop ? "#5b8df8" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      className="rounded-xl p-5"
      style={{
        background: isTop ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
        border: `1px solid ${isTop ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-black" style={{ color: rankColor, fontSize: "clamp(1.5rem,3vw,2.5rem)", lineHeight: 1 }}>#{rank}</p>
          <p className="font-black text-white mt-1" style={{ fontSize: "clamp(1rem,2vw,1.6rem)", lineHeight: 1.2 }}>{emp.name}</p>
          <p className="text-sm mt-1 uppercase tracking-widest" style={{ color: "#4a5568" }}>
            {emp.departement} · {emp.nik}
          </p>
        </div>
        <div className="text-right">
          <p className="font-black tabular-nums" style={{ color: scoreColor, fontSize: "clamp(1.5rem,3vw,2.5rem)", lineHeight: 1 }}>
            <AnimatedScore score={emp.combined_score} />
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#4a5568" }}>combined</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-1.5 rounded-full"
          style={{ background: scoreColor }}
          initial={{ width: 0 }}
          animate={{ width: `${emp.combined_score}%` }}
          transition={{ delay: index * 0.1 + 0.3, duration: 1, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2 flex gap-2 text-xs" style={{ color: "#4a5568" }}>
        <span>Hadir {emp.attendance_rate}%</span>
        <span>·</span>
        <span>Performa {emp.performance_status?.toUpperCase() || "—"}</span>
      </div>
    </motion.div>
  );
}

export default function Display() {
  const { time, date } = useClock();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`);
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

  const top5 = data.slice(0, 5);
  const worst5 = [...data].reverse().slice(0, 5);

  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0b0d14", fontFamily: "Geist, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4" style={{ background: "#10131c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: "#3b6fd4" }}>GAS</div>
          <div>
            <p className="text-xs font-black tracking-widest uppercase text-white">PT. Global Anugerah Setia</p>
            <p className="text-xs tracking-widest uppercase" style={{ color: "#4a5568" }}>HR Performance Ranking</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(91,141,248,0.12)", color: "#5b8df8" }}>
            {monthLabel}
          </span>
          <div className="text-right">
            <p className="font-black tabular-nums text-white" style={{ fontSize: "1.4rem" }}>{time}</p>
            <p className="text-xs capitalize" style={{ color: "#4a5568" }}>{date}</p>
          </div>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex-1 grid grid-cols-2 gap-0">
        {/* Top performers */}
        <div className="p-6" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-black tracking-widest uppercase mb-5" style={{ color: "#22c55e" }}>Top Performers</p>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {top5.map((emp, i) => (
                <RankCard key={emp.user_id} rank={i + 1} emp={emp} variant="top" index={i} />
              ))}
            </AnimatePresence>
            {loaded && top5.length === 0 && (
              <p className="text-sm" style={{ color: "#4a5568" }}>No data available for this month.</p>
            )}
          </div>
        </div>

        {/* Needs improvement */}
        <div className="p-6">
          <p className="text-xs font-black tracking-widest uppercase mb-5" style={{ color: "#ef4444" }}>Needs Improvement</p>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {worst5.map((emp, i) => (
                <RankCard key={emp.user_id} rank={i + 1} emp={emp} variant="bottom" index={i} />
              ))}
            </AnimatePresence>
            {loaded && worst5.length === 0 && (
              <p className="text-sm" style={{ color: "#4a5568" }}>No data available for this month.</p>
            )}
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div className="overflow-hidden py-2.5" style={{ background: "#3b6fd4" }}>
        <div className="flex whitespace-nowrap" style={{ animation: "marquee 40s linear infinite" }}>
          {[1, 2, 3].map(n => (
            <span key={n} className="text-xs font-bold tracking-widest uppercase text-white px-8">
              GROW ACHIEVE SUCCESS &nbsp; &bull; &nbsp; PT. GLOBAL ANUGERAH SETIA INDONESIA &nbsp; &bull; &nbsp; HR PERFORMANCE RANKING &nbsp; &bull; &nbsp;
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
