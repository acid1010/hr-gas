"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Moon, Signal, Sun } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import apiBaseUrl from "@/lib/urlEndPoint";

const REFRESH_INTERVAL = 5 * 60 * 1000;

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

function realtimeStatusMeta(status) {
  if (status === "live") return { label: "Live", helper: "Fingerprint aktif", color: "#16a34a" };
  if (status === "offline") return { label: "Offline", helper: "Menunggu backend", color: "#dc2626" };
  return { label: "Menghubungkan", helper: "Mencari device", color: "#d97706" };
}


function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const time = {
    h: String(now.getHours()).padStart(2, "0"),
    m: String(now.getMinutes()).padStart(2, "0"),
    s: String(now.getSeconds()).padStart(2, "0"),
  };

  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return { time, date, month, monthLabel };
}

function useRefreshCountdown(nextRefreshAt) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));

  useEffect(() => {
    const sync = () => setRemaining(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  return remaining;
}

function Avatar({ employee, size = "lg" }) {
  const sizes = {
    lg: "h-28 w-28 text-5xl rounded-2xl",
    md: "h-14 w-14 text-xl rounded-xl",
    sm: "h-11 w-11 text-base rounded-xl",
  };

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${sizes[size]}`}
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

function SoftStat({ label, value, helper, icon: Icon, p }) {
  return (
    <div className="rounded-2xl border px-4 py-4" style={{ background: p.cardBg, borderColor: p.border }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.muted }}>
          {label}
        </p>
        <Icon size={15} style={{ color: p.primary }} />
      </div>
      <p className="text-3xl font-black tabular-nums leading-none" style={{ color: p.text }}>
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold" style={{ color: p.muted }}>
        {helper}
      </p>
    </div>
  );
}

function ScorePill({ label, value, tone }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: `${tone}12` }}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: tone }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function FocusCard({ employee, loaded, p }) {
  if (!loaded) {
    return (
      <section className="flex h-full min-h-[28rem] items-center justify-center rounded-3xl border" style={{ background: p.cardBg, borderColor: p.border }}>
        <p className="text-sm font-bold" style={{ color: p.muted }}>
          Memuat papan peringkat
        </p>
      </section>
    );
  }

  if (!employee) {
    return (
      <section className="flex h-full min-h-[28rem] flex-col items-center justify-center rounded-3xl border px-8 text-center" style={{ background: p.cardBg, borderColor: p.border }}>
        <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: p.primary }}>
          Display Siap
        </p>
        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ color: p.text }}>
          Belum ada data performa untuk bulan ini
        </h2>
        <p className="mt-3 max-w-xl text-sm font-semibold" style={{ color: p.muted }}>
          Tampilan ini akan otomatis terisi setelah data leaderboard tersedia dari backend.
        </p>
      </section>
    );
  }

  const score = employee.combined_score ?? 0;
  
  const tone = getScoreTone(score);

  return (
    <motion.section
      key={employee.user_id || employee.nik || employee.name}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative min-h-[28rem] overflow-hidden rounded-3xl border px-8 py-8"
      style={{
        background: p.cardBg,
        borderColor: p.border,
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.10)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${tone}10, transparent 48%)` }}
      />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-center gap-6">
          <Avatar employee={employee} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-6xl font-black leading-none" style={{ color: p.text }}>
              {employee.name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.16em]"
                style={{ background: `${deptColor(employee.departement)}20`, color: deptColor(employee.departement) }}
              >
                {employee.departement || "Departemen"}
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: p.muted }}>
                NIK {employee.nik || "-"}
              </span>
              {employee.last_punch && (
                <span className="rounded-full px-4 py-2 text-sm font-black tabular-nums" style={{ background: `${tone}15`, color: tone }}>
                  {new Date(employee.last_punch).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="rounded-3xl p-6 flex flex-col justify-between" style={{ background: p.inputBg }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.muted }}>
              Jam Absensi
            </p>
            <p className="mt-4 text-7xl font-black tabular-nums leading-none font-mono" style={{ color: tone }}>
              {employee.last_punch
                ? new Date(employee.last_punch).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
            <p className="mt-3 text-sm font-semibold" style={{ color: p.muted }}>
              {employee.last_punch
                ? new Date(employee.last_punch).toLocaleDateString("id-ID", { day: "numeric", month: "long" })
                : "Belum ada absensi"}
            </p>
          </div>

          <div className="grid gap-3">
            <ScorePill label="Performa" value={employee.performance_status || "-"} tone={p.primary} />
            <div className="rounded-2xl px-4 py-3 flex-1" style={{ background: `${p.primary}12` }}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: p.primary }}>
                Deskripsi
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug" style={{ color: p.text }}>
                {employee.performance_description || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function RankRow({ employee, rank, p, isFocused }) {
  const score = employee.combined_score ?? 0;
  const tone = getScoreTone(score);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-[3rem_auto_1fr_auto] items-center gap-4 rounded-2xl border px-4 py-3"
      style={{
        background: isFocused ? `${tone}10` : p.cardBg,
        borderColor: isFocused ? `${tone}40` : p.border,
      }}
    >
      <p className="text-center text-lg font-black tabular-nums" style={{ color: tone }}>
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
      <div className="text-right">
        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: p.muted }}>
          Skor
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums leading-none" style={{ color: tone }}>
          {score}
        </p>
      </div>
    </motion.div>
  );
}

export default function Display() {
  const { isDark, p, toggleTheme } = useAppSettings();
  const { time, date, month, monthLabel } = useClock();

  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [, setIsRefreshing] = useState(false);
  const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + REFRESH_INTERVAL);
  const [focusIndex, setFocusIndex] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");

  const inFlightRef = useRef(false);
  const activeRef = useRef(true);
  const controllersRef = useRef(new Set());
  const rankedRef = useRef([]);

  useRefreshCountdown(nextRefreshAt);
  const ranked = [...data].reverse();
  useEffect(() => { rankedRef.current = ranked; }, [ranked]);
  const activeFocusIndex = ranked.length ? focusIndex % ranked.length : 0;
  const focusEmployee = ranked[activeFocusIndex] || ranked[0] || null;
  const visibleQueue = ranked.slice(0, 6);
  const realtime = realtimeStatusMeta(realtimeStatus);

  useEffect(() => {
    activeRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      activeRef.current = false;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  // Snap focus to most recently punched employee whenever data changes
  useEffect(() => {
    if (!data.length) return;
    const r = [...data].reverse();
    let bestIdx = 0;
    let bestTime = null;
    for (let i = 0; i < r.length; i++) {
      if (!r[i].last_punch) continue;
      const t = new Date(r[i].last_punch).getTime();
      if (bestTime === null || t > bestTime) { bestTime = t; bestIdx = i; }
    }
    setFocusIndex(bestIdx);
  }, [data]);

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/attendance/realtime-display`);
    es.onopen = () => setRealtimeStatus("connecting");
    es.onerror = () => setRealtimeStatus("offline");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "status") {
          setRealtimeStatus(event.connected ? "live" : "connecting");
          return;
        }
        if (event.type !== "punch" || !event.user_id) return;
        setRealtimeStatus("live");
        const idx = rankedRef.current.findIndex((emp) => emp.user_id === event.user_id);
        if (idx === -1) return;
        setFocusIndex(idx);
        setData((prev) =>
          prev.map((emp) =>
            emp.user_id === event.user_id ? { ...emp, last_punch: event.punch_time, last_punch_type: event.punch_type } : emp,
          ),
        );
      } catch {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    let intervalId;

    const load = async () => {
      if (inFlightRef.current) return;

      const controller = new AbortController();
      controllersRef.current.add(controller);
      inFlightRef.current = true;

      if (activeRef.current) {
        setIsRefreshing(true);
        setNextRefreshAt(Date.now() + REFRESH_INTERVAL);
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);

        const json = await response.json();
        const nextData = Array.isArray(json.data) ? json.data : [];

        if (!activeRef.current) return;
        setData(nextData);
        setLoaded(true);
        setError("");
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        if (!activeRef.current) return;
        setLoaded(true);
        setError("Koneksi data belum tersedia");
      } finally {
        controllersRef.current.delete(controller);
        inFlightRef.current = false;
        if (activeRef.current) setIsRefreshing(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };

    const handleOnline = () => load();

    load();
    intervalId = setInterval(load, REFRESH_INTERVAL);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [month]);

  return (
    <div
      className="relative min-h-screen overflow-hidden px-6 py-6"
      style={{
        background: p.pageBg,
        color: p.text,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        userSelect: "none",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(circle at top left, rgba(59,111,212,0.15), transparent 36%), radial-gradient(circle at bottom right, rgba(91,141,248,0.12), transparent 34%)"
            : "radial-gradient(circle at top left, rgba(59,111,212,0.10), transparent 36%), radial-gradient(circle at bottom right, rgba(91,141,248,0.08), transparent 34%)",
        }}
      />

      <main className="relative z-10 grid min-h-[calc(100vh-3rem)] grid-rows-[auto_auto_1fr] gap-5">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="PT GAS" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.26em]" style={{ color: p.text }}>
                PT. Global Anugerah Setia
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: p.muted }}>
                Display kinerja SDM
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="rounded-3xl border px-5 py-4 text-right" style={{ background: p.cardBg, borderColor: p.border }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.muted }}>
                Realtime
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Signal size={16} style={{ color: realtime.color }} />
                <span className="text-lg font-black uppercase tracking-[0.12em]" style={{ color: realtime.color }}>
                  {realtime.label}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold" style={{ color: p.muted }}>
                {realtime.helper}
              </p>
            </div>

            <div className="rounded-3xl border px-5 py-4 text-right" style={{ background: p.cardBg, borderColor: p.border }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: p.muted }}>
                Waktu Lokal
              </p>
              <div className="mt-3 flex items-end gap-2 font-mono leading-none tabular-nums">
                <span className="text-6xl font-black" style={{ color: p.text }}>{time.h}</span>
                <span className="pb-1 text-5xl font-black" style={{ color: p.primary }}>:</span>
                <span className="text-6xl font-black" style={{ color: p.text }}>{time.m}</span>
                <span className="pb-1 text-5xl font-black" style={{ color: p.faint }}>:</span>
                <span className="text-6xl font-black" style={{ color: p.muted }}>{time.s}</span>
              </div>
            </div>

            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border transition"
              style={{ background: p.cardBg, borderColor: p.border, color: p.text }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4">
          <SoftStat label="Periode" value={monthLabel} helper={date} icon={CalendarDays} p={p} />
        </section>

        <section className="grid min-h-0 grid-cols-[1.18fr_0.82fr] gap-5">
          <div className="min-h-0">
            <AnimatePresence mode="wait">
              <FocusCard employee={focusEmployee} loaded={loaded} p={p} error={error} />
            </AnimatePresence>
          </div>

          <aside className="flex min-h-0 flex-col rounded-3xl border p-5" style={{ background: p.cardBg, borderColor: p.border }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: p.primary }}>
                  Peringkat Terbawah
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: p.muted }}>
                  Enam skor terendah pada periode berjalan
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: error ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)" }}>
                <Signal size={14} style={{ color: error ? "#dc2626" : "#16a34a" }} />
                <span className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: error ? "#dc2626" : "#16a34a" }}>
                  {error ? "Offline" : "Online"}
                </span>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                <p className="text-sm font-bold">{error}</p>
                <p className="mt-1 text-xs font-semibold">Menampilkan data terakhir yang berhasil dimuat.</p>
              </div>
            ) : null}

            <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
              {visibleQueue.map((employee, index) => {
                const currentFocusKey = focusEmployee?.user_id || focusEmployee?.nik || focusEmployee?.name;
                const rowKey = employee.user_id || employee.nik || employee.name;

                return (
                  <RankRow
                    key={rowKey}
                    employee={employee}
                    rank={index + 1}
                    p={p}
                    isFocused={currentFocusKey === rowKey}
                  />
                );
              })}

              {loaded && visibleQueue.length === 0 ? (
                <div className="flex h-full min-h-40 items-center justify-center rounded-2xl" style={{ background: p.inputBg }}>
                  <p className="text-sm font-bold" style={{ color: p.muted }}>
                    Belum ada data untuk ditampilkan
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </main>

      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
