"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
const DashboardChart = dynamic(() => import("./_DashboardChart"), { ssr: false, loading: () => <div className="h-[196px]" /> });
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useAppSettings } from "@/lib/useAppSettings";
import { Users, CalendarCheck, CalendarX, TrendingUp, ArrowUpRight, Medal, Tv } from "lucide-react";
import Link from "next/link";

// Circular SVG progress ring
function ProgressRing({ value, accent, size = 52, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max((value || 0) / 100, 0), 1);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${accent}18`} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
      />
    </svg>
  );
}

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


export default function Dashboard() {
  const { t, p } = useAppSettings();
  const clock = useClock();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [kpi, setKpi] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0, avgPerf: 0 });
  const [hourlyData, setHourlyData] = useState([]);
  const [absentList, setAbsentList] = useState([]);
  const [deptStats, setDeptStats] = useState([]);
  const [workerStats, setWorkerStats] = useState([]);
  const [topPerformer, setTopPerformer] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const monthStr = todayStr.slice(0, 7);
      const [membersRes, attendanceRes, perfRes, leaderboardRes] = await Promise.all([
        fetchWithAuth(`${apiBaseUrl}/members?limit=500`),
        fetchWithAuth(`${apiBaseUrl}/api/attendance?date=${todayStr}&limit=500`),
        fetchWithAuth(`${apiBaseUrl}/api/performance`),
        fetchWithAuth(`${apiBaseUrl}/api/performance/leaderboard?month=${monthStr}`),
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
      const scores = (perfRes?.data || [])
        .map(d => ratingMap[d.status?.toLowerCase()])
        .filter(v => v !== undefined);
      const avgPerf = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      const allMembers = membersRes?.data || [];
      const absent = allMembers.filter(emp => !presentSet.has(emp.id));

      // Dept-level attendance breakdown
      const deptMap = {};
      for (const emp of allMembers) {
        const d = (emp.departement || "unknown").toLowerCase();
        if (!deptMap[d]) deptMap[d] = { total: 0, present: 0 };
        deptMap[d].total++;
        if (presentSet.has(emp.id)) deptMap[d].present++;
      }
      const deptStats = Object.entries(deptMap)
        .map(([dept, { total, present }]) => ({ dept, total, present, absent: total - present, rate: Math.round((present / total) * 100) }))
        .sort((a, b) => b.rate - a.rate);

      // Worker-type breakdown
      const workerMap = { pkwt: 0, borongan: 0, magang: 0, other: 0 };
      for (const emp of allMembers) {
        const wt = (emp.worker_stats || "").toLowerCase();
        if (wt === "pkwt" || wt === "borongan" || wt === "magang") workerMap[wt]++;
        else workerMap.other++;
      }
      const workerStats = Object.entries(workerMap)
        .map(([type, count]) => ({ type, count, pct: allMembers.length ? Math.round((count / allMembers.length) * 100) : 0 }))
        .filter(w => w.count > 0);

      const leaderboard = leaderboardRes?.data || [];
      const top = leaderboard.length > 0 ? leaderboard[0] : null;

      setKpi({ totalEmployees, presentToday, absentToday, avgPerf });
      setHourlyData(hourlyData);
      setAbsentList(absent);
      setDeptStats(deptStats);
      setWorkerStats(workerStats);
      setTopPerformer(top);
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
        <div className="fade-up mb-8 flex items-end justify-between gap-6 flex-wrap">
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

          <div className="flex flex-col items-end gap-2">
            <div className="text-right hidden xl:block">
              <p className="text-xs font-bold tracking-[0.22em] uppercase" style={{ color: p.faint }}>HR System</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: p.muted }}>{t("dashboard.subtitle")}</p>
            </div>
            <Link
              href="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm"
              style={{
                background: p.cardBg,
                border: `1px solid ${p.border}`,
                color: p.muted,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#5b8df8";
                e.currentTarget.style.color = "#5b8df8";
                e.currentTarget.style.background = `${p.primary}12`;
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(91,141,248,0.15)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = p.border;
                e.currentTarget.style.color = p.muted;
                e.currentTarget.style.background = p.cardBg;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <Tv size={14} />
              <span>{t("dashboard.tvDisplay")}</span>
            </Link>
          </div>
        </div>

        {/* Hairline divider */}
        <div className="fade-up mb-8 h-px w-full" style={{ background: p.border }} />

        {/* KPI BENTO — 4 × 1 col, dense, zero gaps */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          {kpiItems.map(({ label, value, accent, Icon, sub, bar }) => (
            <div
              key={label}
              className="fade-up group relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between cursor-default transition-all duration-300"
              style={{ background: p.cardBg, border: `1px solid ${p.border}`, minHeight: 148 }}
            >
              {/* Ambient glow */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ background: accent, opacity: 0.07, filter: "blur(24px)" }} />

              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
                  <Icon size={18} style={{ color: accent }} />
                </div>
                {bar !== null ? (
                  <div className="relative" style={{ width: 52, height: 52 }}>
                    {loaded && <ProgressRing value={bar} accent={accent} />}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-black tabular-nums" style={{ color: accent }}>{bar}%</span>
                    </div>
                  </div>
                ) : (
                  <ArrowUpRight size={13} style={{ color: p.faint }} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
              </div>

              <div>
                <div className="flex items-end gap-1.5 leading-none mb-1.5">
                  <span className="text-[2.4rem] font-black tracking-tight" style={{ color: accent }}>
                    {loaded ? <Counter to={value} /> : <span>—</span>}
                  </span>
                  {sub && <span className="text-base font-bold pb-1" style={{ color: p.muted }}>{sub}</span>}
                </div>
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: p.faint }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* LIVE MARQUEE TICKER */}
        <div className="fade-up mb-5 overflow-hidden rounded-xl flex items-center" style={{ background: p.cardBg, border: `1px solid ${p.border}`, height: 42 }}>
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
        </div>

        {/* MAIN GRID — 12 cols: chart(7) + spotlight(2) + absent(3) */}
        <div className="grid grid-cols-12 gap-4">

          {/* Area Chart — 7 / 12 */}
          <div className="fade-up col-span-12 xl:col-span-7 rounded-2xl overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
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
              <DashboardChart data={hourlyData} />
            </div>
          </div>

          {/* Performance Spotlight — 2 / 12 */}
          <div className="fade-up col-span-12 xl:col-span-2 rounded-2xl flex flex-col overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
            <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: `1px solid ${p.border}` }}>
              <Medal size={12} style={{ color: "#f59e0b" }} />
              <p className="text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>Top Performer</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
              {topPerformer ? (
                <>
                  {/* Pulsing glow avatar */}
                  <div className="relative" style={{ width: 72, height: 72 }}>
                    <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 2px #f59e0b44, 0 0 20px #f59e0b18" }} />
                    <div
                      className="relative w-full h-full rounded-full overflow-hidden"
                      style={{ background: deptColor(topPerformer.departement) }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center font-black text-white text-xl">
                        {(topPerformer.name || "?")[0].toUpperCase()}
                      </div>
                      {topPerformer.link_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getDrivePreview(topPerformer.link_image)} alt={topPerformer.name} className="absolute inset-0 w-full h-full object-cover" />
                      )}
                    </div>
                  </div>

                  {/* #1 badge */}
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                    #1 This Month
                  </span>

                  {/* Name + dept */}
                  <div className="text-center min-w-0 w-full">
                    <p className="font-black text-sm leading-snug truncate" style={{ color: p.text }}>{topPerformer.name}</p>
                    {topPerformer.departement && (
                      <span className="text-[10px] font-black uppercase" style={{ color: deptColor(topPerformer.departement) }}>
                        {topPerformer.departement}
                      </span>
                    )}
                  </div>

                  {/* Score ring */}
                  <div className="relative" style={{ width: 64, height: 64 }}>
                    <ProgressRing value={topPerformer.combined_score} accent="#f59e0b" size={64} stroke={5} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-base font-black tabular-nums leading-none" style={{ color: "#f59e0b" }}>{topPerformer.combined_score}</span>
                      <span className="text-[9px] font-bold" style={{ color: p.faint }}>score</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.08)" }}>
                    <Medal size={20} style={{ color: "#f59e0b", opacity: 0.4 }} />
                  </div>
                  <p className="text-xs text-center" style={{ color: p.faint }}>No data this month</p>
                </div>
              )}
            </div>
          </div>

          {/* Absent list — 3 / 12 */}
          <div className="fade-up col-span-12 xl:col-span-3 rounded-2xl flex flex-col overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
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
                <>
                  {absentList.map((emp) => (
                    <div
                      key={emp.id}
                      className="fade-up flex items-center gap-3 px-5 py-3 transition-colors duration-150 cursor-default"
                      style={{ borderBottom: `1px solid ${p.border}` }}
                      onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div
                        className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"
                        style={{ background: deptColor(emp.departement) }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        {emp.link_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: p.text }}>{emp.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono" style={{ color: p.faint }}>{emp.nik}</span>
                          {emp.departement && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}>
                              {emp.departement.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#ef4444", boxShadow: "0 0 4px #ef4444" }} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>

        {/* DEPT ATTENDANCE BREAKDOWN */}
        {deptStats.length > 0 && (
          <div className="fade-up mt-4 rounded-2xl overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.border}` }}>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>
                {t("dashboard.deptBreakdown")}
              </p>
              <span className="text-[10px] font-bold" style={{ color: p.faint }}>{t("dashboard.today")}</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {deptStats.map(({ dept, total, present, absent: absCnt, rate }) => {
                const color = deptColor(dept);
                const barColor = rate >= 80 ? "#22c55e" : rate >= 60 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={dept} className="fade-up flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs font-black uppercase tracking-wider" style={{ color }}>{dept}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tabular-nums" style={{ color: barColor }}>{rate}%</span>
                        <span className="text-[10px] tabular-nums" style={{ color: p.faint }}>{present}/{total}</span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: p.border2 }}>
                      <div className="h-full rounded-full" style={{ background: barColor, width: `${rate}%` }} />
                    </div>
                    {absCnt > 0 && (
                      <p className="text-[10px]" style={{ color: "#ef444490" }}>{absCnt} absent</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WORKER TYPE DISTRIBUTION */}
        {workerStats.length > 0 && (
          <div className="fade-up mt-4 rounded-2xl overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${p.border}` }}>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: p.faint }}>
                {t("dashboard.workforceComposition")}
              </p>
              <span className="text-[10px] font-bold" style={{ color: p.faint }}>{kpi.totalEmployees} total</span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Stacked bar */}
              <div className="flex h-5 rounded-full overflow-hidden gap-px">
                {workerStats.map(({ type, pct }) => {
                  const colors = { pkwt: "#5b8df8", borongan: "#f59e0b", magang: "#6b7a99", other: "#4a5568" };
                  return (
                    <div
                      key={type}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ background: colors[type] || "#4a5568", width: `${pct}%` }}
                      title={`${type.toUpperCase()}: ${pct}%`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-5 flex-wrap">
                {workerStats.map(({ type, count, pct }) => {
                  const colors = { pkwt: "#5b8df8", borongan: "#f59e0b", magang: "#6b7a99", other: "#4a5568" };
                  const color = colors[type] || "#4a5568";
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                      <div>
                        <span className="text-xs font-black uppercase tracking-wide" style={{ color }}>{type}</span>
                        <span className="text-xs font-bold ml-1.5 tabular-nums" style={{ color: p.faint }}>{count} <span style={{ color: p.faint }}>({pct}%)</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
