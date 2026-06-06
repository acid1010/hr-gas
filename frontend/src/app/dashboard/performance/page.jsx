"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, AlertTriangle, Fingerprint, Building2 } from "lucide-react";
import Image from "next/image";
import apiBaseUrl from "@/lib/urlEndPoint";
import fetchWithAuth from "@/lib/fetchWithAuth";

const ITEMS_PER_PAGE = 5;

const getDrivePreview = (url) => {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400` : url;
};

/* ---------- single employee row card ---------- */
function EmployeeCard({ emp, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-6 rounded-2xl overflow-hidden h-full"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(239,68,68,0.14)",
      }}
    >
      {/* Rank */}
      <div
        className="shrink-0 flex items-center justify-center font-black tabular-nums"
        style={{
          width: 80,
          alignSelf: "stretch",
          background: "rgba(239,68,68,0.06)",
          borderRight: "1px solid rgba(239,68,68,0.1)",
          color: "rgba(239,68,68,0.3)",
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
        }}
      >
        {index + 1}
      </div>

      {/* Photo */}
      <div
        className="shrink-0 rounded-xl overflow-hidden"
        style={{
          width: 72,
          height: 72,
          background: "#1a2035",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {emp.photo ? (
          <Image
            src={getDrivePreview(emp.photo)}
            alt={emp.name}
            width={72}
            height={72}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-black text-2xl"
            style={{ color: "#4a5568" }}
          >
            {(emp.name || "?")[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-black text-white truncate" style={{ fontSize: "clamp(1rem, 2vw, 1.5rem)" }}>
          {emp.name}
        </p>
        <div className="flex items-center gap-4 mt-1.5">
          <div className="flex items-center gap-1.5">
            <Fingerprint size={13} style={{ color: "#5b8df8" }} />
            <span className="font-mono text-sm font-bold" style={{ color: "#6b7a99" }}>{emp.nik}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 size={13} style={{ color: "#5b8df8" }} />
            <span className="text-sm font-bold uppercase tracking-wide truncate" style={{ color: "#6b7a99" }}>
              {emp.departement}
            </span>
          </div>
        </div>
      </div>

      {/* Description badge + worst pill */}
      <div className="shrink-0 flex items-center gap-3 pr-6">
        {emp.description && emp.description !== "-" && (
          <div
            className="px-4 py-2 rounded-xl text-sm font-semibold max-w-[200px] truncate"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              color: "#ef4444",
            }}
          >
            {emp.description}
          </div>
        )}
        <span
          className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
        >
          Worst
        </span>
      </div>
    </motion.div>
  );
}

/* ---------- live clock ---------- */
function useClock() {
  const [time, setTime] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime({ h: String(n.getHours()).padStart(2,"0"), m: String(n.getMinutes()).padStart(2,"0"), s: String(n.getSeconds()).padStart(2,"0") });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* ---------- main page ---------- */
export default function DashboardTV() {
  const [data,      setData]      = useState([]);
  const [page,      setPage]      = useState(0);
  const [loaded,    setLoaded]    = useState(false);
  const clock = useClock();

  const load = useCallback(async () => {
    try {
      const result = await fetchWithAuth(`${apiBaseUrl}/api/performance/`);
      const raw    = result?.data || result || [];
      setData(raw.map(item => ({
        id:          item.id,
        name:        item.users?.name        || item.name        || "—",
        nik:         item.users?.nik         || item.nik         || "—",
        departement: item.users?.departement || "—",
        description: item.description        || "",
        status:      (item.status || "").toLowerCase(),
        photo:       item.users?.link_image  || "",
      })));
      setLoaded(true);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const worst = data.filter(d => d.status === "worst").slice(0, 10);
  const pages = Math.ceil(worst.length / ITEMS_PER_PAGE);
  const current = worst.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  /* auto-slide */
  const [slideProgress, setSlideProgress] = useState(0);
  useEffect(() => {
    if (pages <= 1) { setSlideProgress(0); return; }
    setSlideProgress(0);
    const startTime = Date.now();
    const DURATION = 5000;
    const rafId = { current: null };
    const tick = () => {
      const elapsed = Date.now() - startTime;
      setSlideProgress(Math.min(elapsed / DURATION, 1));
      if (elapsed < DURATION) rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    const id = setInterval(() => {
      setPage(p => (p + 1) % pages);
      setSlideProgress(0);
    }, DURATION);
    return () => { clearInterval(id); cancelAnimationFrame(rafId.current); };
  }, [pages, page]);

  const date = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: "#060810", fontFamily: "var(--font-geist, Geist, system-ui, sans-serif)" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(239,68,68,0.05), transparent 70%)" }} />

      {/* HEADER */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-4 shrink-0"
        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: "#3b6fd4", boxShadow: "0 0 18px rgba(59,111,212,0.4)" }}>
            GAS
          </div>
          <div>
            <p className="text-sm font-black tracking-widest uppercase text-white">PT. Global Anugerah Setia</p>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6b7a99" }}>
              Performance Monitor · Needs Evaluation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle size={14} style={{ color: "#ef4444" }} />
            <span className="text-sm font-black uppercase tracking-widest" style={{ color: "#ef4444" }}>
              Worst Performers
            </span>
          </div>

          <div className="text-right">
            <div className="flex items-end gap-0 tabular-nums" style={{ fontFamily: "var(--font-geist-mono, monospace)", lineHeight: 1 }}>
              <span className="font-black text-white" style={{ fontSize: "2rem" }}>{clock.h}</span>
              <span className="font-black pb-0.5" style={{ color: "#3b6fd4", fontSize: "1.6rem" }}>:</span>
              <span className="font-black text-white" style={{ fontSize: "2rem" }}>{clock.m}</span>
              <span className="font-black pb-0.5" style={{ color: "rgba(255,255,255,0.18)", fontSize: "1.6rem" }}>:</span>
              <span className="font-black" style={{ color: "rgba(255,255,255,0.3)", fontSize: "2rem" }}>{clock.s}</span>
            </div>
            <p className="text-[10px] font-semibold capitalize mt-0.5" style={{ color: "#4a5568" }}>{date}</p>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="relative z-10 flex-1 min-h-0 px-8 py-6 flex flex-col gap-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-h-0 grid gap-3"
            style={{ gridTemplateRows: `repeat(${ITEMS_PER_PAGE}, 1fr)` }}
          >
            {current.map((emp, i) => (
              <EmployeeCard key={emp.id} emp={emp} index={page * ITEMS_PER_PAGE + i} />
            ))}
            {loaded && current.length === 0 && (
              <div
                className="row-span-5 flex flex-col items-center justify-center gap-4 rounded-3xl"
                style={{ border: "1px dashed rgba(255,255,255,0.06)", gridRow: `span ${ITEMS_PER_PAGE}` }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <AlertTriangle size={28} style={{ color: "#4a5568" }} />
                </div>
                <p className="text-base font-black uppercase tracking-widest" style={{ color: "#4a5568" }}>No worst performers found</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* PAGINATION */}
      {pages > 1 && (
        <footer
          className="relative z-10 flex flex-col gap-0 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}
        >
          {/* Progress bar — auto-slide timer */}
          <div className="h-[2px] w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div
              className="h-full rounded-full transition-none"
              style={{ background: "#ef4444", width: `${slideProgress * 100}%`, opacity: 0.7 }}
            />
          </div>
          <div className="flex items-center justify-center gap-6 py-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b7a99", opacity: page === 0 ? 0.25 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: pages }).map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setPage(i)}
                className="rounded-full transition-all duration-300"
                animate={{ width: i === page ? 28 : 8, background: i === page ? "#ef4444" : "rgba(255,255,255,0.15)" }}
                style={{ height: 8 }}
              />
            ))}
          </div>

          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="p-2 rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b7a99", opacity: page === pages - 1 ? 0.25 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            <ChevronRight size={16} />
          </button>
          </div>
        </footer>
      )}

      {/* TICKER */}
      <div className="relative z-10 overflow-hidden shrink-0" style={{ background: "#ef4444", height: 32 }}>
        <div className="flex items-center h-full whitespace-nowrap" style={{ animation: "ticker 45s linear infinite" }}>
          {[1, 2, 3, 4].map(n => (
            <span key={n} className="text-[10px] font-black tracking-widest uppercase text-white px-10">
              PERFORMANCE EVALUATION REQUIRED
              <span className="mx-8 opacity-50">·</span>
              PT. GLOBAL ANUGERAH SETIA INDONESIA
              <span className="mx-8 opacity-50">·</span>
              NEEDS IMPROVEMENT
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
      `}</style>
    </div>
  );
}
