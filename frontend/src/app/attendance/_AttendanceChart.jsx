"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAppSettings } from "@/lib/useAppSettings";

function ChartTooltip({ active, payload, label }) {
  const { p } = useAppSettings();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-bold shadow-xl" style={{ background: p.cardBg, color: p.text, border: "1px solid rgba(91,141,248,0.2)" }}>
      <p style={{ color: "#5b8df8" }}>{label}:00</p>
      <p>{payload[0].value} punches</p>
    </div>
  );
}

export default function AttendanceChart({ data }) {
  const { p } = useAppSettings();
  const currentHour = String(new Date().getHours()).padStart(2, "0");
  const maxPunches = Math.max(...data.map(d => d.punches));
  const chartData = data.map(entry => {
    const isCurrent = entry.hour === currentHour;
    const isPeak = entry.punches === maxPunches && entry.punches > 0;
    return {
      ...entry,
      fill: isCurrent ? "#5b8df8" : isPeak ? "url(#barGradPeak)" : "url(#barGrad)",
      fillOpacity: isCurrent ? 1 : isPeak ? 0.95 : 0.75,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={148}>
      <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8df8" stopOpacity={1} />
            <stop offset="100%" stopColor="#3b6fd4" stopOpacity={0.65} />
          </linearGradient>
          <linearGradient id="barGradPeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ba5fa" stopOpacity={1} />
            <stop offset="100%" stopColor="#5b8df8" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <XAxis dataKey="hour" tick={{ fill: p.faint, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
        <YAxis tick={{ fill: p.faint, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(91,141,248,0.07)", radius: 6 }} />
        <ReferenceLine x={currentHour} stroke="#5b8df8" strokeDasharray="3 3" strokeOpacity={0.45} />
        <Bar dataKey="punches" radius={[5, 5, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
