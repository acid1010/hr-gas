"use client";
import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

export const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
export function deptColor(d) { return DEPT_COLORS[(d || "").toLowerCase()] || "#4a5568"; }

export function getDrivePreview(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400` : url;
}

export const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

export function Counter({ to, duration = 1.2 }) {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const t0 = performance.now();
    const ms = duration * 1000;
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      if (ref.current) ref.current.textContent = Math.round(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = to;
    };
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <span ref={ref}>0</span>;
}

const PERF_STYLE = {
  best:    { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", dot: "#22c55e" },
  good:    { bg: "rgba(91,141,248,0.12)", color: "#5b8df8", dot: "#5b8df8" },
  average: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", dot: "#f59e0b" },
  worst:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", dot: "#ef4444" },
};

export function PerfBadge({ value }) {
  const s = PERF_STYLE[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.1)", color: "#6b7a99", dot: "#6b7a99" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {value?.toUpperCase() || "—"}
    </span>
  );
}

export function ScoreBar({ score, barBg }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <span className="text-base font-black tabular-nums w-8 shrink-0" style={{ color }}>{score}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: barBg, minWidth: 80 }}>
        <div
          className="h-full rounded-full score-bar-animated"
          style={{ background: color, width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function DeleteButton({ label, confirmLabel, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <button
        onClick={() => { setConfirming(false); onConfirm(); }}
        onMouseLeave={() => setConfirming(false)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-black text-white"
        style={{ background: "#ef4444" }}
      >
        {confirmLabel}
      </button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
    >
      <Trash2 size={13} />
    </button>
  );
}
