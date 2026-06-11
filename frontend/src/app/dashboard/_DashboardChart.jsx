"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAppSettings } from "@/lib/useAppSettings";

function CustomTooltip({ active, payload, label }) {
  const { p } = useAppSettings();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-bold shadow-xl" style={{ background: p.cardBg, color: p.text, border: "1px solid rgba(91,141,248,0.2)" }}>
      <p style={{ color: "#5b8df8" }}>{label}:00</p>
      <p>{payload[0].value} punches</p>
    </div>
  );
}

export default function DashboardChart({ data }) {
  const { p } = useAppSettings();
  const currentHour = String(new Date().getHours()).padStart(2, "0");
  return (
    <ResponsiveContainer width="100%" height={196}>
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8df8" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#5b8df8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="hour"
          tick={{ fill: p.faint, fontSize: 10, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}h`}
        />
        <YAxis
          tick={{ fill: p.faint, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          x={currentHour}
          stroke="#5b8df8"
          strokeDasharray="3 3"
          strokeOpacity={0.4}
          label={{ value: "Now", position: "top", fill: "#5b8df8", fontSize: 9, fontWeight: 700 }}
        />
        <Area
          type="monotone"
          dataKey="punches"
          stroke="#5b8df8"
          strokeWidth={2.5}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 5, fill: "#5b8df8", stroke: p.cardBg, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
