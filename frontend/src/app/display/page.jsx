"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Factory,
  Gauge,
  Moon,
  RotateCcw,
  Sun,
  TrendingDown,
} from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import apiBaseUrl from "@/lib/urlEndPoint";

const REFRESH_INTERVAL = 5 * 60 * 1000;

const RANK_ACCENTS = [
  { label: "01", color: "#ef4444", soft: "rgba(239,68,68,0.14)" },
  { label: "02", color: "#f97316", soft: "rgba(249,115,22,0.13)" },
  { label: "03", color: "#f59e0b", soft: "rgba(245,158,11,0.13)" },
];

const DEPT_COLORS = {
  production: "#3b6fd4",
  engineering: "#8b5cf6",
  qc: "#f59e0b",
  maintenance: "#ef4444",
  warehouse: "#10b981",
  hr: "#5b8df8",
  ga: "#f97316",
  it: "#06b6d4",
};

function deptColor(department) {
  return DEPT_COLORS[(department || "").toLowerCase()] || "#64748b";
}

function getDrivePreview(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400` : url;
}

function getScoreTone(score) {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#d97706";
  return "#dc2626";
}

function useClock() {
  const [time, setTime] = useState({ h: "00", m: "00", s: "00" });
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime({
        h: String(now.getHours()).padStart(2, "0"),
        m: String(now.getMinutes()).padStart(2, "0"),
        s: String(now.getSeconds()).padStart(2, "0"),
      });
      setDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { time, date };
}

function useRefreshCountdown(intervalMs) {
  const [secs, setSecs] = useState(Math.floor(intervalMs / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setSecs((current) => (current <= 1 ? Math.floor(intervalMs / 1000) : current - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [intervalMs]);

  return secs;
}

function AnimatedNumber({ value }) {
  const ref = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    let current = 0;
    const step = Math.max(target / 34, 1);
    const id = setInterval(() => {
      current = Math.min(target, current + step);
      if (ref.current) ref.current.textContent = String(Math.round(current));
      if (current >= target) clearInterval(id);
    }, 18);

    return () => clearInterval(id);
  }, [value]);

  return <span ref={ref}>0</span>;
}

function Avatar({ employee, size = "md" }) {
  const sizes = {
    lg: "h-28 w-28 text-5xl",
    md: "h-12 w-12 text-lg",
    sm: "h-9 w-9 text-sm",
  };

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg ${sizes[size]}`}
      style={{ background: deptColor(employee?.departement) }}
    >
      <div className="absolute inset-0 flex items-center justify-center font-black text-white">
        {(employee?.name || "?")[0].toUpperCase()}
      </div>
      {employee?.link_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getDrivePreview(employee.link_image)}
          alt={employee.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

function MetricBlock({ label, value, tone, suffix = "" }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
      <p className="truncate text-2xl font-black tabular-nums" style={{ color: tone }}>
        {value}
        {suffix}
      </p>
    </div>
  );
}

function StatusPill({ icon: Icon, label, value, p }) {
  return (
    <div
      className="flex h-12 items-center gap-3 rounded-lg border px-4"
      style={{ background: p.cardBg, borderColor: p.border }}
    >
      <Icon size={17} style={{ color: p.primary }} />
      <div className="leading-none">
        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: p.muted }}>
          {label}
        </p>
        <p className="mt-1 text-sm font-black tabular-nums" style={{ color: p.text }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function AttentionPanel({ employee, p, loaded }) {
  if (!loaded) {
    return (
      <section
        className="flex h-full items-center justify-center rounded-lg border"
        style={{ background: p.cardBg, borderColor: p.border }}
      >
        <p className="text-sm font-bold" style={{ color: p.muted }}>
          Memuat papan peringkat
        </p>
      </section>
    );
  }

  if (!employee) {
    return (
      <section
        className="flex h-full items-center justify-center rounded-lg border"
        style={{ background: p.cardBg, borderColor: p.border }}
      >
        <p className="text-sm font-bold" style={{ color: p.muted }}>
          Belum ada data untuk bulan ini
        </p>
      </section>
    );
  }

  const score = employee.combined_score ?? 0;
  const tone = getScoreTone(score);

  return (
    <motion.section
      key={employee.user_id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full overflow-hidden rounded-lg border"
      style={{ background: p.cardBg, borderColor: "rgba(220,38,38,0.24)" }}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: tone }} />
      <div
        className="absolute inset-y-0 right-0 w-1/2 opacity-60"
        style={{ background: `linear-gradient(135deg, transparent, ${RANK_ACCENTS[0].soft})` }}
      />

      <div className="relative flex h-full flex-col p-7">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.32em]" style={{ color: tone }}>
              Perlu Perhatian
            </p>
            <h1 className="max-w-[11ch] text-6xl font-black leading-[0.92]" style={{ color: p.text }}>
              Prioritas Kinerja
            </h1>
          </div>
          <div className="rounded-lg px-4 py-3 text-right" style={{ background: "rgba(220,38,38,0.10)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: tone }}>
              Rank
            </p>
            <p className="text-5xl font-black tabular-nums" style={{ color: tone }}>
              01
            </p>
          </div>
        </div>

        <div className="mt-auto">
          <div className="mb-6 flex items-end gap-5">
            <Avatar employee={employee} size="lg" />
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-4xl font-black leading-none" style={{ color: p.text }}>
                {employee.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-[0.16em]"
                  style={{ background: `${deptColor(employee.departement)}20`, color: deptColor(employee.departement) }}
                >
                  {employee.departement || "Departemen"}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: p.muted }}>
                  NIK {employee.nik || "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-7 grid grid-cols-3 gap-4" style={{ color: p.text }}>
            <MetricBlock label="Kehadiran" value={employee.attendance_rate ?? 0} suffix="%" tone={getScoreTone(employee.attendance_rate ?? 0)} />
            <MetricBlock label="Performa" value={employee.performance_status || "-"} tone={p.primary} />
            <MetricBlock label="Skor" value={<AnimatedNumber value={score} />} tone={tone} />
          </div>

          <div className="h-3 overflow-hidden rounded-full" style={{ background: p.inputBg }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: tone }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PodiumCard({ employee, rank, p }) {
  if (!employee) return <div className="min-h-0" />;

  const accent = RANK_ACCENTS[rank - 1] || RANK_ACCENTS[2];
  const score = employee.combined_score ?? 0;
  const tone = getScoreTone(score);

  return (
    <motion.div
      key={employee.user_id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="grid min-h-0 grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border p-4"
      style={{ background: p.cardBg, borderColor: accent.color }}
    >
      <div className="text-3xl font-black tabular-nums" style={{ color: accent.color }}>
        {accent.label}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar employee={employee} size="md" />
        <div className="min-w-0">
          <p className="truncate text-xl font-black leading-tight" style={{ color: p.text }}>
            {employee.name}
          </p>
          <p className="truncate text-xs font-bold uppercase tracking-[0.16em]" style={{ color: p.muted }}>
            {employee.departement || "-"} / {employee.nik || "-"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: p.muted }}>
          Skor
        </p>
        <p className="text-3xl font-black tabular-nums" style={{ color: tone }}>
          {score}
        </p>
      </div>
    </motion.div>
  );
}

function RankRow({ employee, rank, index, p }) {
  const score = employee.combined_score ?? 0;
  const tone = getScoreTone(score);
  const accent = rank <= 3 ? RANK_ACCENTS[rank - 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.035, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-[3.5rem_auto_1fr_7rem] items-center gap-4 rounded-lg border px-4 py-3"
      style={{ background: accent ? accent.soft : p.cardBg, borderColor: accent ? `${accent.color}55` : p.border }}
    >
      <p className="text-center text-lg font-black tabular-nums" style={{ color: accent?.color || p.muted }}>
        {String(rank).padStart(2, "0")}
      </p>
      <Avatar employee={employee} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-base font-black" style={{ color: p.text }}>
          {employee.name}
        </p>
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: p.muted }}>
          {employee.departement || "-"} / {employee.nik || "-"}
        </p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: p.inputBg }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: tone }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ delay: index * 0.035 + 0.2, duration: 0.55 }}
          />
        </div>
        <p className="w-9 text-right text-xl font-black tabular-nums" style={{ color: tone }}>
          {score}
        </p>
      </div>
    </motion.div>
  );
}

export default function Display() {
  const { isDark, p, toggleTheme } = useAppSettings();
  const { time, date } = useClock();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const refreshIn = useRefreshCountdown(REFRESH_INTERVAL);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`);
      if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
      const json = await response.json();
      setData(Array.isArray(json.data) ? json.data : []);
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setError("Koneksi data belum tersedia");
      setLoaded(true);
    }
  }, [month]);

  useEffect(() => {
    const startId = setTimeout(load, 0);
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => {
      clearTimeout(startId);
      clearInterval(id);
    };
  }, [load]);

  const ranked = useMemo(() => [...data].reverse(), [data]);
  const focusEmployee = ranked[0] || null;
  const runnerUp = ranked[1] || null;
  const third = ranked[2] || null;
  const averageScore = ranked.length
    ? Math.round(ranked.reduce((sum, employee) => sum + (employee.combined_score ?? 0), 0) / ranked.length)
    : 0;
  const lowScoreCount = ranked.filter((employee) => (employee.combined_score ?? 0) < 60).length;
  const progress = (refreshIn / (REFRESH_INTERVAL / 1000)) * 100;

  return (
    <div
      className="relative h-screen overflow-hidden px-6 py-5"
      style={{ background: p.pageBg, color: p.text, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", userSelect: "none" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(59,111,212,0.12), transparent 38%, rgba(245,158,11,0.07))"
            : "linear-gradient(135deg, rgba(59,111,212,0.10), transparent 40%, rgba(220,38,38,0.05))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage: "linear-gradient(90deg, currentColor 1px, transparent 1px), linear-gradient(0deg, currentColor 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          color: p.text,
        }}
      />

      <main className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-5">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="PT GAS" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em]" style={{ color: p.text }}>
                PT. Global Anugerah Setia
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: p.muted }}>
                Papan kontrol kinerja SDM
              </p>
            </div>
          </div>

          <div className="flex items-end font-mono leading-none tabular-nums">
            <span className="text-6xl font-black" style={{ color: p.text }}>{time.h}</span>
            <span className="pb-1 text-5xl font-black" style={{ color: p.primary }}>:</span>
            <span className="text-6xl font-black" style={{ color: p.text }}>{time.m}</span>
            <span className="pb-1 text-5xl font-black" style={{ color: p.faint }}>:</span>
            <span className="text-6xl font-black" style={{ color: p.muted }}>{time.s}</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <StatusPill icon={CalendarDays} label="Periode" value={monthLabel} p={p} />
            <StatusPill icon={Factory} label="Tanggal" value={date} p={p} />
            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="flex h-12 w-12 items-center justify-center rounded-lg border transition"
              style={{ background: p.cardBg, borderColor: p.border, color: p.text }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="grid min-h-0 grid-cols-[1.06fr_0.94fr] gap-5">
          <div className="min-h-0">
            <AnimatePresence mode="wait">
              <AttentionPanel employee={focusEmployee} p={p} loaded={loaded} />
            </AnimatePresence>
          </div>

          <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-4">
            <div className="grid grid-cols-3 gap-4">
              <StatusPill icon={Gauge} label="Rata-rata" value={`${averageScore}`} p={p} />
              <StatusPill icon={TrendingDown} label="Di bawah 60" value={`${lowScoreCount}`} p={p} />
              <StatusPill icon={RotateCcw} label="Refresh" value={`${Math.floor(refreshIn / 60)}:${String(refreshIn % 60).padStart(2, "0")}`} p={p} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PodiumCard employee={runnerUp} rank={2} p={p} />
              <PodiumCard employee={third} rank={3} p={p} />
            </div>

            <section className="flex min-h-0 flex-col rounded-lg border p-4" style={{ background: p.cardBg, borderColor: p.border }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: p.primary }}>
                    Antrian Peringkat
                  </p>
                  <p className="mt-1 text-xs font-bold" style={{ color: p.muted }}>
                    Urutan dari skor paling rendah ke paling tinggi
                  </p>
                </div>
                {error ? (
                  <p className="rounded-md px-3 py-1 text-xs font-black" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
                <AnimatePresence>
                  {ranked.map((employee, index) => (
                    <RankRow
                      key={employee.user_id || `${employee.nik}-${index}`}
                      employee={employee}
                      rank={index + 1}
                      index={index}
                      p={p}
                    />
                  ))}
                </AnimatePresence>
                {loaded && ranked.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm font-bold" style={{ color: p.muted }}>
                      Belum ada data untuk bulan ini
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </section>

        <footer className="grid h-10 grid-cols-[1fr_auto] items-center overflow-hidden rounded-lg" style={{ background: p.primary }}>
          <div className="overflow-hidden whitespace-nowrap">
            <div className="inline-flex h-full items-center" style={{ animation: "display-ticker 52s linear infinite" }}>
              {[1, 2, 3, 4].map((item) => (
                <span key={item} className="px-10 text-xs font-black uppercase tracking-[0.24em] text-white">
                  Grow Achieve Success / PT. Global Anugerah Setia Indonesia / Papan Peringkat Kinerja SDM /
                </span>
              ))}
            </div>
          </div>
          <div className="h-full w-48 px-4 py-3" style={{ background: "rgba(0,0,0,0.18)" }}>
            <div className="h-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
              <motion.div className="h-full rounded-full bg-white" animate={{ width: `${progress}%` }} transition={{ duration: 0.85, ease: "linear" }} />
            </div>
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes display-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-25%); }
        }

        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
