"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

export default function Drawer({ open, onClose, title, subtitle, accentColor, children }) {
  const { p } = useAppSettings();
  const accent = accentColor || "#3b6fd4";

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)", animation: "page-enter 0.22s ease both" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative flex flex-col w-[480px] h-full overflow-y-auto z-10"
        style={{
          background: p.cardBg,
          borderLeft: `1px solid ${p.border}`,
          animation: "drawer-slide-in 0.28s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

        <div
          className="relative flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${p.border}` }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none" style={{ background: `linear-gradient(90deg, ${accent}08, transparent)` }} />
          <div className="relative">
            <h2 className="text-base font-black tracking-tight" style={{ color: p.text }}>{title}</h2>
            {subtitle && <p className="text-[11px] font-medium mt-0.5" style={{ color: p.faint }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors duration-150 shrink-0"
            style={{ color: p.faint }}
            onMouseEnter={e => { e.currentTarget.style.background = p.inputBg; e.currentTarget.style.color = p.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = p.faint; }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 fade-up" style={{ animationDelay: "0.1s" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
