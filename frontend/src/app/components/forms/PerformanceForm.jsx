"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useAppSettings } from "@/lib/useAppSettings";

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

const PerformanceForm = ({ onSubmit }) => {
  const { p } = useAppSettings();
  const [employees, setEmployees] = useState([]);
  const [status,    setStatus]    = useState("");
  const [quarter,   setQuarter]   = useState("");

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/members?limit=10000`)
      .then(res => setEmployees(res?.data || []))
      .catch(console.error);
  }, []);

  const inputStyle = {
    background: p.inputBg,
    border: `1px solid ${p.border2}`,
    color: p.text,
    borderRadius: "0.75rem",
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    appearance: "none",
  };

  const labelStyle = {
    fontSize: "0.68rem",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: p.faint,
    display: "block",
    marginBottom: "0.375rem",
  };

  const onFocus = (e) => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; };
  const onBlur  = (e) => { e.target.style.borderColor = p.border2;   e.target.style.boxShadow = "none"; };

  return (
    <div className="flex flex-col gap-5">
      {/* Employee select */}
      <div>
        <label style={labelStyle}>Employee</label>
        <select
          name="user_id"
          required
          defaultValue=""
          style={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          <option value="" disabled>Select employee…</option>
          {employees.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.nik} · {u.departement}
            </option>
          ))}
        </select>
      </div>

      {/* Quarter — 4-tile picker */}
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

      {/* Status — 4-color pill picker */}
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
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-150"
                style={{ background: status === value ? color : p.faint }}
              />
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
          style={{
            ...inputStyle,
            resize: "none",
            lineHeight: "1.6",
            padding: "0.75rem 1rem",
          }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
};

export default PerformanceForm;
