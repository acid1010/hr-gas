"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Users, Fingerprint, TrendingUp, Clock,
  ArrowRight, X, ChevronRight,
} from "lucide-react";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useAppSettings } from "@/lib/useAppSettings";

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

const NAV_ITEMS = [
  { label: "Dashboard",   href: "/dashboard",             icon: LayoutDashboard },
  { label: "Employees",   href: "/employee",              icon: Users },
  { label: "Attendance",  href: "/attendance",            icon: Fingerprint },
  { label: "Performance", href: "/employee/performance",  icon: TrendingUp },
  { label: "Overtime",    href: "/overtime",              icon: Clock },
];

export default function CommandPalette() {
  const { p } = useAppSettings();
  const router = useRouter();

  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState("");
  const [emps,     setEmps]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [cursor,   setCursor]   = useState(0);
  const inputRef   = useRef(null);
  const debounceRef = useRef(null);

  /* open/close keyboard shortcut + sidebar button event */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(v => !v); }
      if (e.key === "Escape") setOpen(false);
    };
    const onCmd = () => setOpen(v => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("gas:cmd", onCmd);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("gas:cmd", onCmd); };
  }, []);

  /* focus input when palette opens */
  useEffect(() => {
    if (open) {
      setQuery("");
      setEmps([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  /* fetch employees on query change */
  const search = useCallback(async (q) => {
    if (!q.trim()) { setEmps([]); return; }
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${encodeURIComponent(q)}&limit=6`);
      setEmps(res.data || []);
    } catch { setEmps([]); }
    finally { setLoading(false); }
  }, []);

  const handleQuery = (val) => {
    setQuery(val);
    setCursor(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 220);
  };

  /* items list for keyboard nav */
  const showNav  = query.trim() === "";
  const navItems = showNav
    ? NAV_ITEMS.filter(n => !query || n.label.toLowerCase().includes(query.toLowerCase()))
    : [];
  const items = showNav ? navItems : emps;
  const total = items.length;

  const go = (item) => {
    setOpen(false);
    if (showNav) {
      router.push(item.href);
    } else {
      router.push(`/employee?keyword=${encodeURIComponent(item.name)}`);
    }
  };

  /* keyboard navigation inside palette */
  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, total - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && items[cursor]) go(items[cursor]);
  };

  return (
    <>
      {/* Global trigger hint — also triggered via keyboard */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="cp-backdrop"
            className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)" }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="cp-panel"
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full overflow-hidden rounded-2xl"
              style={{
                maxWidth: 560,
                background: p.cardBg,
                border: `1px solid ${p.border}`,
                boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Search row */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: `1px solid ${p.border}` }}
              >
                <Search size={17} style={{ color: p.faint, flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search employees, navigate pages…"
                  value={query}
                  onChange={e => handleQuery(e.target.value)}
                  onKeyDown={handleKey}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: p.text, caretColor: "#5b8df8" }}
                />
                {query && (
                  <button onClick={() => handleQuery("")} style={{ color: p.faint }}>
                    <X size={14} />
                  </button>
                )}
                <kbd
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.faint }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {/* Nav items (shown when query is empty) */}
                {showNav && (
                  <>
                    <p
                      className="px-4 pt-3 pb-1 text-[10px] font-black tracking-[0.22em] uppercase"
                      style={{ color: p.faint }}
                    >
                      Navigate
                    </p>
                    {NAV_ITEMS.map((item, i) => {
                      const Icon = item.icon;
                      const active = cursor === i;
                      return (
                        <button
                          key={item.href}
                          onClick={() => go(item)}
                          onMouseEnter={() => setCursor(i)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors duration-100"
                          style={{
                            background: active ? p.rowHover : "transparent",
                            color: active ? p.text : p.muted,
                          }}
                        >
                          <Icon size={15} style={{ color: active ? "#5b8df8" : p.faint }} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight size={13} style={{ color: p.faint, opacity: active ? 1 : 0 }} />
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Employee results */}
                {!showNav && (
                  <>
                    {loading && (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: p.faint }}>
                        Searching…
                      </div>
                    )}
                    {!loading && emps.length === 0 && query.trim() && (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: p.faint }}>
                        No employees found for &quot;{query}&quot;
                      </div>
                    )}
                    {!loading && emps.length > 0 && (
                      <>
                        <p
                          className="px-4 pt-3 pb-1 text-[10px] font-black tracking-[0.22em] uppercase"
                          style={{ color: p.faint }}
                        >
                          Employees
                        </p>
                        {emps.map((emp, i) => {
                          const active = cursor === i;
                          const color = deptColor(emp.departement);
                          return (
                            <button
                              key={emp.id}
                              onClick={() => go(emp)}
                              onMouseEnter={() => setCursor(i)}
                              className="w-full flex items-center gap-3 px-4 py-3 transition-colors duration-100"
                              style={{ background: active ? p.rowHover : "transparent" }}
                            >
                              {/* Avatar */}
                              <div
                                className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"
                                style={{ background: color }}
                              >
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                                  {(emp.name || "?")[0].toUpperCase()}
                                </div>
                                {emp.link_image && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={getDrivePreview(emp.link_image)}
                                    alt={emp.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold truncate" style={{ color: p.text }}>{emp.name}</p>
                                <p className="text-[11px] font-mono truncate" style={{ color: p.faint }}>
                                  {emp.nik} · {emp.departement?.toUpperCase() || "—"}
                                </p>
                              </div>
                              {/* Status */}
                              <div className="shrink-0 flex items-center gap-2">
                                <span
                                  className="text-[10px] font-black px-2 py-0.5 rounded-md"
                                  style={{ background: `${color}18`, color }}
                                >
                                  {(emp.departement || "").toUpperCase()}
                                </span>
                                <ArrowRight size={13} style={{ color: p.faint, opacity: active ? 1 : 0 }} />
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: `1px solid ${p.border}`, background: p.inputBg }}
              >
                <div className="flex items-center gap-3">
                  {[
                    ["↑↓", "navigate"],
                    ["↵",  "select"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <kbd
                        className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: p.cardBg, border: `1px solid ${p.border2}`, color: p.faint }}
                      >
                        {key}
                      </kbd>
                      <span className="text-[10px]" style={{ color: p.faint }}>{label}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] font-bold" style={{ color: p.faint }}>
                  {total} result{total !== 1 ? "s" : ""}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
