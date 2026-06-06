"use client";

export default function StatChip({ label, value, sub, color = "#5b8df8" }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl px-5 py-4"
      style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#4a5568" }}>
        {label}
      </p>
      <p className="text-3xl font-black tracking-tight" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "#4a5568" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
