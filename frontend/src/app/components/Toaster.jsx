"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

const VARIANTS = {
  success: { icon: CheckCircle2, color: "#22c55e", border: "rgba(34,197,94,0.28)",  bg: "rgba(34,197,94,0.06)"  },
  error:   { icon: XCircle,      color: "#ef4444", border: "rgba(239,68,68,0.28)",  bg: "rgba(239,68,68,0.06)"  },
  warning: { icon: AlertTriangle, color: "#f59e0b", border: "rgba(245,158,11,0.28)", bg: "rgba(245,158,11,0.06)" },
  info:    { icon: Info,          color: "#5b8df8", border: "rgba(91,141,248,0.28)", bg: "rgba(91,141,248,0.06)" },
};

function ToastItem({ id, msg, type, duration, exiting, onDismiss, onRemove }) {
  const { p } = useAppSettings();
  const v = VARIANTS[type] || VARIANTS.info;
  const Icon = v.icon;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`relative flex items-start gap-3 pr-10 pl-4 pt-3.5 pb-4 rounded-2xl overflow-hidden ${exiting ? "toast-out" : "toast-in"}`}
      style={{
        background: p.cardBg,
        border: `1px solid ${v.border}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.2)",
        minWidth: 280,
        maxWidth: 380,
      }}
      onAnimationEnd={() => { if (exiting) onRemove(id); }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-full" style={{ background: v.color }} />
      <Icon size={18} className="shrink-0 mt-0.5" style={{ color: v.color }} />
      <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: p.text }}>{msg}</p>
      <button
        onClick={() => onDismiss(id)}
        className="absolute top-2.5 right-2.5 p-1 rounded-lg transition-colors duration-100"
        style={{ color: p.faint }}
        onMouseEnter={e => { e.currentTarget.style.color = p.text; e.currentTarget.style.background = p.inputBg; }}
        onMouseLeave={e => { e.currentTarget.style.color = p.faint; e.currentTarget.style.background = "transparent"; }}
      >
        <X size={13} />
      </button>
      <div
        className="absolute bottom-0 left-0 h-[2px] rounded-full toast-progress-bar"
        style={{ background: v.color, opacity: 0.45, animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      setToasts(prev => [...prev.slice(-4), e.detail]);
    };
    window.addEventListener("gas:toast", handler);
    return () => window.removeEventListener("gas:toast", handler);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onDismiss={dismiss} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
