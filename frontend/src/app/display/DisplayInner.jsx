"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Signal, Sun } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import apiBaseUrl from "@/lib/urlEndPoint";

const REFRESH_INTERVAL = 3 * 60 * 1000;
const DISPLAY_EXCLUDED_NIKS = new Set([
  "260101399", // Ekasulaksana
  "260401535", // Andriarisucipto
  "250500575", // Andriyantopermana
  "260101400", // Achmatmustajib
  "260101401", // Diankurniawan
  "220300029", // Safuansimabdulah
  "260201421", // Rahtihcaturprasetyo
  "220200008", // Dadanmardani
  "250901139", // Juwandani
]);

const MOTIVATIONAL_QUOTES = [
  "Satu orang terlambat, satu proses bisa ikut terhambat.",
  "Setiap menit sangat berarti dalam proses produksi.",
  "Tepat waktu adalah awal dari kerja yang profesional.",
  "Keterlambatan kecil bisa berdampak besar pada proses kerja.",
  "Disiplin waktu mencerminkan kualitas kerja.",
  "Pabrik yang kuat dibangun oleh tim yang disiplin.",
  "Datang tepat waktu adalah bukti komitmen terhadap pekerjaan.",
  "Produktivitas dimulai saat kita hadir tepat waktu dan siap bekerja.",
  "Tepat waktu bukan hanya aturan, tetapi bentuk tanggung jawab.",
  "Budaya kerja yang baik dimulai dari kebiasaan tepat waktu.",
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

function isDisplayExcluded(employee) {
  return DISPLAY_EXCLUDED_NIKS.has(String(employee?.nik || "").trim());
}

function formatAttendanceTime(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
}

function getLocalDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapDisplayAttendance(record) {
  const user = record.users || {};
  return {
    user_id: user.id || record.user_id,
    name: user.name || "-",
    nik: user.nik || record.device_uid || "-",
    departement: user.departement || null,
    link_image: user.link_image || null,
    last_punch: record.punch_time,
    combined_score: 0,
  };
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
  if (status === "offline") return { label: "Offline", helper: "Device tidak terhubung", color: "#dc2626" };
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
    lg: "h-36 w-36 text-6xl rounded-[2rem] ring-4 ring-white/70 shadow-2xl",
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

function QuotePanel({ quote, p }) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full overflow-hidden rounded-[2rem] border px-8 py-8"
      style={{
        background: `linear-gradient(145deg, ${p.cardBg}, ${p.inputBg})`,
        borderColor: p.border,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 24px 70px rgba(15,23,42,0.08)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 86% 18%, rgba(59,111,212,0.18), transparent 34%), radial-gradient(circle at 10% 90%, rgba(220,38,38,0.08), transparent 34%)",
        }}
      />
      <div className="pointer-events-none absolute right-8 top-8 flex gap-2 opacity-25">
        {[0, 1, 2, 3, 4].map((line) => (
          <span key={line} className="block h-16 w-1 rounded-full" style={{ background: p.primary }} />
        ))}
      </div>
      <div className="relative grid h-full w-full grid-cols-[auto_1fr] items-center gap-7">
        <div className="h-full w-2 rounded-full" style={{ background: p.primary }} />
        <div className="relative flex min-h-64 items-center">
          <span className="absolute -left-2 -top-10 font-serif text-[9rem] font-black leading-none opacity-10" style={{ color: p.primary }}>
            “
          </span>
          <blockquote className="relative max-w-2xl text-5xl font-black leading-[1.03] tracking-[-0.055em] text-balance" style={{ color: p.text }}>
            {quote}
          </blockquote>
        </div>
      </div>
    </motion.section>
  );
}

function FocusCard({ employee, loaded, p }) {
  if (!loaded) {
    return (
      <section className="flex h-full items-center justify-center rounded-3xl border" style={{ background: p.cardBg, borderColor: p.border }}>
        <p className="text-sm font-bold" style={{ color: p.muted }}>
          Memuat papan peringkat
        </p>
      </section>
    );
  }

  if (!employee) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-3xl border px-8 text-center" style={{ background: p.cardBg, borderColor: p.border }}>
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
  const attendanceTime = formatAttendanceTime(employee.last_punch);

  return (
    <motion.section
      key={employee.user_id || employee.nik || employee.name}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full overflow-hidden rounded-[2rem] border px-8 py-8"
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
        <div className="flex items-center gap-8">
          <Avatar employee={employee} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-6xl font-black leading-none tracking-[-0.05em]" style={{ color: p.text }}>
              {employee.name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.16em]"
                style={{ background: `${deptColor(employee.departement)}20`, color: deptColor(employee.departement) }}
              >
                {employee.departement || "Departemen"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col rounded-3xl p-6" style={{ background: p.inputBg }}>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-2xl font-black uppercase tracking-[0.26em]" style={{ color: p.muted }}>
              Jam Absensi
            </p>
            <p className="mt-6 text-8xl font-black tabular-nums leading-none font-mono tracking-[-0.08em]" style={{ color: tone }}>
              {attendanceTime}
            </p>
            <p className="mt-3 text-sm font-semibold" style={{ color: p.muted }}>
              {employee.last_punch
                ? new Date(employee.last_punch).toLocaleDateString("id-ID", { day: "numeric", month: "long" })
                : "Belum ada absensi"}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function RankRow({ employee, rank, p, isFocused }) {
  const score = employee.combined_score ?? 0;
  const tone = getScoreTone(score);
  const attendanceTime = formatAttendanceTime(employee.last_punch);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="grid h-full min-h-0 grid-cols-[3.5rem_auto_1fr_auto] items-center gap-5 rounded-[1.45rem] border px-6 py-3"
      style={{
        background: isFocused ? `${tone}10` : p.cardBg,
        borderColor: isFocused ? `${tone}40` : p.border,
      }}
    >
      <p className="text-center text-2xl font-black tabular-nums tracking-[-0.05em]" style={{ color: tone }}>
        {String(rank).padStart(2, "0")}
      </p>
      <Avatar employee={employee} size="md" />
      <div className="min-w-0">
        <p className="truncate text-2xl font-black tracking-[-0.04em]" style={{ color: p.text }}>
          {employee.name}
        </p>
        <p className="mt-1 truncate text-base font-black tabular-nums tracking-[0.1em]" style={{ color: p.muted }}>
          {employee.departement || "-"} / {employee.nik || "-"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: p.muted }}>
          Jam Absensi
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums leading-none tracking-[-0.08em]" style={{ color: tone }}>
          {attendanceTime}
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
  const loadLatestAttendanceRef = useRef(null);

  useRefreshCountdown(nextRefreshAt);
  // Only today's latest attendance records are shown on the TV board.
  const attending = data.filter(e => e.last_punch !== null);
  const ranked = attending;
  useEffect(() => { rankedRef.current = ranked; }, [ranked]);
  const visibleQueue = ranked.slice(0, 3);
  const activeFocusIndex = visibleQueue.length ? focusIndex % visibleQueue.length : 0;
  const focusEmployee = visibleQueue[activeFocusIndex] || visibleQueue[0] || null;
  const realtime = realtimeStatusMeta(realtimeStatus);
  const quote = MOTIVATIONAL_QUOTES[new Date().getDate() % MOTIVATIONAL_QUOTES.length];

  useEffect(() => {
    activeRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      activeRef.current = false;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    if (visibleQueue.length && focusIndex >= visibleQueue.length) setFocusIndex(0);
  }, [focusIndex, visibleQueue.length]);

  useEffect(() => {
    if (visibleQueue.length <= 1) return undefined;
    const id = setInterval(() => {
      setFocusIndex((current) => (current + 1) % visibleQueue.length);
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [visibleQueue.length]);

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/attendance/realtime-display`);
    es.onopen = () => setRealtimeStatus("connecting");
    es.onerror = () => setRealtimeStatus("offline");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "status") {
          setRealtimeStatus(event.connected ? "live" : "offline");
          return;
        }
        if (event.type !== "punch" || !event.user_id) return;
        setRealtimeStatus("live");
        loadLatestAttendanceRef.current?.(event.user_id);
        const idx = rankedRef.current.findIndex((emp) => emp.user_id === event.user_id);
        if (idx === -1 || idx > 5) return;
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

    loadLatestAttendanceRef.current = async (focusUserId = null) => {
      if (inFlightRef.current) return;

      const controller = new AbortController();
      controllersRef.current.add(controller);
      inFlightRef.current = true;

      if (activeRef.current) {
        setIsRefreshing(true);
        setNextRefreshAt(Date.now() + REFRESH_INTERVAL);
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/attendance/display-latest?date=${getLocalDateKey()}&limit=20`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Display attendance request failed: ${response.status}`);

        const json = await response.json();
        const nextData = Array.isArray(json.data)
          ? json.data.map(mapDisplayAttendance).filter((emp) => !isDisplayExcluded(emp))
          : [];

        if (!activeRef.current) return;
        setData(nextData);
        if (focusUserId) {
          const idx = nextData.slice(0, 3).findIndex((emp) => emp.user_id === focusUserId);
          if (idx !== -1) setFocusIndex(idx);
        }
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
      if (document.visibilityState === "visible") loadLatestAttendanceRef.current?.();
    };

    const handleOnline = () => loadLatestAttendanceRef.current?.();

    loadLatestAttendanceRef.current();
    intervalId = setInterval(() => loadLatestAttendanceRef.current?.(), REFRESH_INTERVAL);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      loadLatestAttendanceRef.current = null;
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [month]);

  return (
    <div
      className="relative h-screen overflow-hidden px-6 py-6"
      style={{
        background: p.pageBg,
        color: p.text,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        userSelect: "none",
        cursor: "none",
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

      <main className="relative z-10 grid h-full w-full max-w-full grid-rows-[auto_1fr] gap-5 overflow-hidden">
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

        <section className="grid min-h-0 h-full grid-flow-dense grid-cols-12 grid-rows-[1fr_auto] gap-5 overflow-hidden">
          <div className="col-span-7 min-h-0 h-full">
            <AnimatePresence mode="wait">
              <FocusCard employee={focusEmployee} loaded={loaded} p={p} error={error} />
            </AnimatePresence>
          </div>

          <div className="col-span-5 min-h-0 h-full">
            <QuotePanel quote={quote} p={p} />
          </div>

          <aside className="col-span-12 rounded-[2rem] border p-6" style={{ background: p.cardBg, borderColor: p.border }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: p.primary }}>
                  Peringkat Terbawah
                </p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em]" style={{ color: p.text }}>
                  Enam absensi terakhir pada periode berjalan
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: p.muted }}>
                  {monthLabel} / {date}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full px-5 py-4" style={{ background: error ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)" }}>
                <Signal size={18} style={{ color: error ? "#dc2626" : "#16a34a" }} />
                <span className="text-lg font-black uppercase tracking-[0.22em]" style={{ color: error ? "#dc2626" : "#16a34a" }}>
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

            <div className="mt-5 flex flex-col gap-3">
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
        ::-webkit-scrollbar { display: none; }
        html, body {
          overflow: hidden !important;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
