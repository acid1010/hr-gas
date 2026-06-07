"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, X } from "lucide-react";
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

const STATUS_OPTIONS = [
  { value: "best",    label: "Best",    color: "#22c55e" },
  { value: "good",    label: "Good",    color: "#5b8df8" },
  { value: "average", label: "Average", color: "#f59e0b" },
  { value: "worst",   label: "Worst",   color: "#ef4444" },
];

const QUARTERS = [
  { value: "1", label: "Q1", sub: "Jan – Mar" },
  { value: "2", label: "Q2", sub: "Apr – Jun" },
  { value: "3", label: "Q3", sub: "Jul – Sep" },
  { value: "4", label: "Q4", sub: "Oct – Dec" },
];

/* ---- Searchable employee picker ---- */
function EmployeePicker({ employees, selected, onSelect, p }) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? employees.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        String(u.nik).includes(query) ||
        (u.departement || "").toLowerCase().includes(query.toLowerCase())
      )
    : employees;

  const labelStyle = {
    fontSize: "0.68rem", fontWeight: "800", textTransform: "uppercase",
    letterSpacing: "0.15em", color: p.faint, display: "block", marginBottom: "0.375rem",
  };

  return (
    <div ref={ref} className="relative">
      <label style={labelStyle}>Employee</label>
      <input type="hidden" name="user_id" value={selected?.id || ""} required />

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setQuery(""); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
        style={{
          background: p.inputBg,
          border: `1px solid ${open ? "#5b8df8" : p.border2}`,
          boxShadow: open ? "0 0 0 3px rgba(91,141,248,0.1)" : "none",
          color: p.text,
        }}
      >
        {selected ? (
          <>
            <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(selected.departement) }}>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                {(selected.name || "?")[0].toUpperCase()}
              </div>
              {selected.link_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getDrivePreview(selected.link_image)} alt={selected.name} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: p.text }}>{selected.name}</p>
              <p className="text-[11px] font-mono" style={{ color: p.faint }}>{selected.nik}</p>
            </div>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0"
              style={{ background: `${deptColor(selected.departement)}18`, color: deptColor(selected.departement) }}
            >
              {(selected.departement || "").toUpperCase()}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="shrink-0 ml-1 transition-colors"
              style={{ color: p.faint }}
              onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.color = p.faint; }}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm" style={{ color: p.faint }}>Select employee…</span>
            <ChevronDown size={14} style={{ color: p.faint, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl overflow-hidden"
            style={{ background: p.cardBg, border: `1px solid ${p.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.35)" }}
          >
            {/* Search */}
            <div className="p-2" style={{ borderBottom: `1px solid ${p.border}` }}>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search name, NIK, department…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: p.faint }}>No employees found</div>
              ) : filtered.map((u, i) => (
                <motion.button
                  key={u.id}
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  onClick={() => { onSelect(u); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100"
                  style={{
                    background: selected?.id === u.id ? `${deptColor(u.departement)}12` : "transparent",
                    borderBottom: `1px solid ${p.border}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected?.id === u.id ? `${deptColor(u.departement)}12` : "transparent"; }}
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(u.departement) }}>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                      {(u.name || "?")[0].toUpperCase()}
                    </div>
                    {u.link_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getDrivePreview(u.link_image)} alt={u.name} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: p.text }}>{u.name}</p>
                    <p className="text-[11px] font-mono" style={{ color: p.faint }}>{u.nik}</p>
                  </div>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: `${deptColor(u.departement)}18`, color: deptColor(u.departement) }}
                  >
                    {(u.departement || "").toUpperCase()}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---- Main form ---- */
const PerformanceForm = ({ onSubmit }) => {
  const { p } = useAppSettings();
  const currentQuarter = String(Math.ceil((new Date().getMonth() + 1) / 3));
  const [employees, setEmployees] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [status,    setStatus]    = useState("");
  const [quarter,   setQuarter]   = useState(currentQuarter);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/members?limit=10000`)
      .then(res => setEmployees(res?.data || []))
      .catch(console.error);
  }, []);

  const inputStyle = {
    background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text,
    borderRadius: "0.75rem", padding: "0.625rem 1rem", fontSize: "0.875rem",
    width: "100%", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s", appearance: "none",
  };

  const labelStyle = {
    fontSize: "0.68rem", fontWeight: "800", textTransform: "uppercase",
    letterSpacing: "0.15em", color: p.faint, display: "block", marginBottom: "0.375rem",
  };

  const onFocus = (e) => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; };
  const onBlur  = (e) => { e.target.style.borderColor = p.border2; e.target.style.boxShadow = "none"; };

  return (
    <div className="flex flex-col gap-5">

      <EmployeePicker employees={employees} selected={selected} onSelect={setSelected} p={p} />

      {/* Quarter */}
      <div>
        <label style={labelStyle}>Quarter</label>
        <input type="hidden" name="quarter" value={quarter} required />
        <div className="grid grid-cols-4 gap-2">
          {QUARTERS.map(({ value, label, sub }) => (
            <motion.button
              key={value}
              type="button"
              onClick={() => setQuarter(value)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center py-2.5 px-1 rounded-xl text-sm font-bold transition-all duration-150"
              style={quarter === value
                ? { background: "rgba(91,141,248,0.14)", border: "1.5px solid #5b8df8", color: "#5b8df8" }
                : { background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }
              }
            >
              <span className="font-black">{label}</span>
              <span className="text-[10px] font-semibold mt-0.5 opacity-70">{sub}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <label style={labelStyle}>Performance Status</label>
        <input type="hidden" name="status" value={status} required />
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <motion.button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-150"
              style={status === value
                ? { background: `${color}14`, border: `1.5px solid ${color}`, color }
                : { background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }
              }
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-150" style={{ background: status === value ? color : p.faint }} />
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Achievement details or evaluation notes…"
          style={{ ...inputStyle, resize: "none", lineHeight: "1.6", padding: "0.75rem 1rem" }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
};

export default PerformanceForm;
