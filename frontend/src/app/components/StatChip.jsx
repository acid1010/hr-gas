"use client";
import { useAppSettings } from "@/lib/useAppSettings";

export default function StatChip({ label, value, sub, color = "#5b8df8" }) {
  const { p } = useAppSettings();
  return (
    <div
      className="flex-1 min-w-0 rounded-xl px-5 py-4 transition-colors duration-300"
      style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
    >
      <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-1" style={{ color: p.faint }}>
        {label}
      </p>
      <p className="text-3xl font-black tracking-tight leading-none" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1.5 font-semibold" style={{ color: p.muted }}>{sub}</p>
      )}
    </div>
  );
}
