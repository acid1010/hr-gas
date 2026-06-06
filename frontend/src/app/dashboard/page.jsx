"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useAppSettings } from "@/lib/useAppSettings";
import { Users, CalendarCheck, CalendarX, TrendingUp, ArrowUpRight } from "lucide-react";

// Ease-out-expo animated counter
function Counter({ to, duration = 1.4 }) {
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

function CustomTooltip({ active, payload, label, bg, text }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: bg, border: "1px solid rgba(91,141,248,0.3)", borderRadius: 10, padding: "8px 14px", color: text, fontSize: 12, fontWeight: 700, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
      <div style={{ color: "#5b8df8", marginBottom: 2 }}>{label}:00</div>
      <div>{payload[0].value} punches</div>
    </div>
  );
}

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(d) { return DEPT_COLORS[(d || "").toLowerCase()] || "#4a5568"; }

function useClock() {
  const [t, setT] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setT({ h: String(n.getHours()).padStart(2, "0"), m: String(n.getMinutes()).padStart(2, "0"), s: String(n.getSeconds()).padStart(2, "0") });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Dashboard() {
  const { t, p } = useAppSettings();
  const clock = useClock();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [kpi, setKpi] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0, avgPerf: 0 });
  const [hourlyData, setHourlyData] = useState([]);
  const [absentList, setAbsentList] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [membersRes, attendanceRes, perfRes] = await Promise.all([
        fetchWithAuth(`${apiBaseUrl}/members?limit=500`),
        fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${todayStr}&limit=500`),
        fetchWithAuth(`${apiBaseUrl}/api/performance`),
      ]);

      const totalEmployees = membersRes?.total || 0;
      const allPunches = attendanceRes?.data || [];
      const presentSet = new Set(allPunches.filter(r => r.user_id).map(r => r.user_id));
      const presentToday = presentSet.size;
      const absentToday = Math.max(0, totalEmployees - presentToday);

      const hourMap = {};
      for (let h = 6; h <= 22; h++) hourMap[h] = 0;
      for (const r of allPunches) {
        const h = new Date(r.punch_time).getHours();
        if (hourMap[h] !== undefined) hourMap[h]++;
      }
      const hourlyData = Object.entries(hourMap).map(([h, cnt]) => ({ hour: String(h).padStart(2, "0"), punches: cnt }));

      const ratingMap = { best: 100, good: 75, average: 50, worst: 25 };
      const scores = (perfRes?.data || []).map(d => ratingMap[d.status?.toLowerCase()] ?? 0).filter(Boolean);
      const avgPerf = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      const absent = (membersRes?.data || []).filter(emp => !presentSet.has(emp.id));

      setKpi({ totalEmployees, presentToday, absentToday, avgPerf });
      setHourlyData(hourlyData);
      setAbsentList(absent);
      setLoaded(true);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  const attendanceRate = kpi.totalEmployees > 0 ? Math.round((kpi.presentToday / kpi.totalEmployees) * 100) : 0;
  const perfAccent = kpi.avgPerf >= 80 ? "#22c55e" : kpi.avgPerf >= 60 ? "#f59e0b" : "#ef4444";

  const kpiItems = [
    { label: t("dashboard.totalEmployees"), value: kpi.totalEmployees, accent: "#5b8df8", Icon: Users,         sub: null,                   bar: null },
    { label: t("dashboard.presentToday"),   value: kpi.presentToday,   accent: "#22c55e", Icon: CalendarCheck, sub: `${attendanceRate}%`,   bar: attendanceRate },
    { label: t("dashboard.absentToday"),    value: kpi.absentToday,    accent: kpi.absentToday > 0 ? "#ef4444" : "#22c55e", Icon: CalendarX, sub: null, bar: kpi.totalEmployees > 0 ? Math.round((kpi.absentToday / kpi.totalEmployees) * 100) : 0 },
    { label: t("dashboard.avgPerformance"), value: kpi.avgPerf,        accent: perfAccent, Icon: TrendingUp,   sub: "/ 100",                bar: kpi.avgPerf },
  ];

  const marqueeItems = [
    `${kpi.totalEmployees} total employees`,
    `${kpi.presentToday} present today`,
    `${kpi.absentToday} absent`,
    `${attendanceRate}% attendance rate`,
    `Performance avg ${kpi.avgPerf}/100`,
  ];

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* HEADER — Editorial split: date | clock | label */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-end justify-between gap-6 flex-wrap"
        >
          <div>
            <p className="text-xs font-bold tracking-[0.22em] uppercase mb-1.5" style={{ color: p.primary }}>
              PT. Global Anugerah Setia
            </p>
            <h1 className="text-[1.65rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
              {today}
            </h1>
          </div>

          {/* Dramatic live clock — the focal anchor */}
          <div
            className="flex items-end gap-0 tabular-nums select-none"
            style={{ fontFamily: "var(--font-geist-mono)", lineHeight: 1 }}
          >
            <span className="text-[3.5rem] font-black leading-none" style={{ color: p.text }}>{clock.h}</span>
            <span className="text-[2.8rem] font-black leading-none pb-0.5 px-1" style={{ color: "#5b8df8" }}>:</span>
            <span className="text-[3.5rem] font-black leading-none" style={{ color: p.text }}>{clock.m}</span>
            <span className="text-[2.8rem] font-black leading-none pb-0.5 px-1" style={{ color: p.border2 }}>:</span>
            <span className="text-[3.5rem] font-black leading-none" style={{ color: p.faint }}>{clock.s}</span>
          </div>

          <div className="text-right hidden xl:block">
            <p className="text-xs font-bold tracking-[0.22em] uppercase" style={{ color: p.faint }}>HR System</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: p.muted }}>{t("dashboard.subtitle")}</p>
          </div>
        </motion.div>

        {/* Hairline divider */}
        <motion.div
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 h-px w-full"
          style={{ background: p.border }}
        />

        {/* KPI BENTO — 4 × 1 col, dense, zero gaps */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          {kpiItems.map(({ label, value, accent, Icon, sub, bar }, i) => (
            <motion.div
              key={label}
              custom={i}
              initial="hidden"
              animate={loaded ? "visible" : "hidden"}
              variants={cardVariants}
              className="group relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between cursor-default transition-all duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}`, minHeight: 148 }}
              whileHover={{ scale: 1.025, transition: { duration: 0.3, ease: "easeOut" } }}
            >
              {/* Ambient glow */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ background: accent, opacity: 0.07, filter: "blur(24px)" }} />

              <div className="flex items-center justify-between mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
                  <Icon size={18} style={{ color: accent }} />
                </div>
                <ArrowUpRight size={13} style={{ color: p.faint }} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>

              <div>
                <div className="flex items-end gap-1.5 leading-none mb-1.5">
                  <span className="text-[2.4rem] font-black tracking-tight" style={{ color: accent }}>
                    {loaded ? <Counter to={value} /> : <span>—</span>}
                  </span>
                  {sub && <span className="text-base font-bold pb-1" style={{ color: p.muted }}>{sub}</span>}
                </div>
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: p.faint }}>{label}</p>
                {bar !== null && (
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: `${accent}18` }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: accent }}
                      initial={{ width: 0 }}
                      animate={loaded ? { width: `${Math.min(bar, 100)}%` } : { width: 0 }}
                      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 + 0.4 }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* LIVE MARQUEE TICKER */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-5 overflow-hidden rounded-xl flex items-center"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, height: 42 }}
        >
          <div className="shrink-0 flex items-center gap-2 px-4 h-full" style={{ borderRight: `1px solid ${p.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "pulse 2s ease-in-out infinite" }} />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: "#22c55e" }}>Live</span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className="flex whitespace-nowrap" style={{ animation: "marquee 22s linear infinite" }}>
              {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, i) => (
                <span key={i} className="text-xs font-semibold px-6" style={{ color: p.muted }}>
                  {item}
                  <span className="mx-6" style={{ color: p.faint }}>·</span>
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* MAIN GRID — 12 cols: chart(7) + list(5) */}
        <div className="grid grid-cols-12 gap-4">

          {/* Area Chart — 7 / 12 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ delay: 0.38, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-12 xl:col-span-7 rounded-2xl overflow-hidden transition-colors duration-300"
            style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
          >
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.border}` }}>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>
                {t("dashboard.attendanceChart")}
              </p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-0.5 rounded-full" style={{ background: "#5b8df8" }} />
                <span className="text-[10px] font-bold tracking-wide" style={{ color: p.faint }}>punches / hour</span>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={196}>
                <AreaChart data={hourlyData} margin={{ top: 4, right: 2, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5b8df8" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#5b8df8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: p.faint, fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}h`}
                  />
                  <YAxis
                    tick={{ fill: p.faint, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip bg={p.cardBg} text={p.text} />} />
                  <Area
                    type="monotone"
                    dataKey="punches"
                    stroke="#5b8df8"
                    strokeWidth={2.5}
                    fill="url(#areaGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#5b8df8", stroke: p.cardBg, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Absent list — 5 / 12 */}
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: loaded ? 1 : 0, x: loaded ? 0 : 18 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-12 xl:col-span-5 rounded-2xl flex flex-col overflow-hidden transition-colors duration-300"
            style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
          >
            <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${p.border}` }}>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>
                {t("dashboard.absentList")}
              </p>
              {absentList.length > 0 && (
                <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                  {absentList.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 268 }}>
              {absentList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                    <CalendarCheck size={18} style={{ color: "#22c55e" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("dashboard.allPresent")}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {absentList.map((emp, i) => (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: i * 0.035, duration: 0.28 }}
                      className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 cursor-default"
                      style={{ borderBottom: `1px solid ${p.border}` }}
                      onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white"
                        style={{ background: deptColor(emp.departement) }}
                      >
                        {(emp.name || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: p.text }}>{emp.name}</p>
                        <p className="text-[11px] truncate" style={{ color: p.faint }}>
                          {emp.nik} · {emp.departement?.toUpperCase() || "—"}
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#ef4444", boxShadow: "0 0 4px #ef4444" }} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </main>
  );
}
