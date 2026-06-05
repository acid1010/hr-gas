import { Users, Clock, TrendingUp, CalendarX } from "lucide-react";
import Link from "next/link";

const StatCard = ({ title, icon: Icon, stats, href }) => (
  <div
    className="rounded-xl p-6 flex flex-col gap-4 transition-all duration-150 cursor-default group"
    style={{ background: "#12161f", border: "1px solid rgba(255,255,255,0.06)" }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.25)"; e.currentTarget.style.background = "#151a26"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#12161f"; }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(91,141,248,0.12)" }}>
          <Icon size={18} style={{ color: "#5b8df8" }} />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#6b7a99" }}>
          {title}
        </h3>
      </div>
      <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
    </div>

    <div className="space-y-1.5">
      {stats.map(({ label, value }) => (
        <div key={label} className="flex items-baseline justify-between">
          <span className="text-xs" style={{ color: "#4a5568" }}>{label}</span>
          <span className="text-2xl font-bold" style={{ color: "#5b8df8" }}>{value}</span>
        </div>
      ))}
    </div>

    {href && (
      <Link
        href={href}
        className="mt-auto text-xs font-semibold tracking-widest uppercase transition-colors"
        style={{ color: "#3b6fd4" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#5b8df8"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#3b6fd4"; }}
      >
        View details →
      </Link>
    )}
  </div>
);

export default function Dashboard() {
  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>
          Overview
        </p>
        <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#4a5568" }}>
          PT. Global Anugerah Setia — HR Portal
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Employee"
          icon={Users}
          href="/employee"
          stats={[{ label: "Total aktif", value: "1.000" }]}
        />
        <StatCard
          title="Absence"
          icon={CalendarX}
          stats={[
            { label: "Present", value: "400" },
            { label: "Permit", value: "5" },
            { label: "Not present", value: "7" },
          ]}
        />
        <StatCard
          title="Performance"
          icon={TrendingUp}
          href="/employee/performance"
          stats={[
            { label: "Best", value: "5" },
            { label: "Worst", value: "10" },
          ]}
        />
        <StatCard
          title="Overtime"
          icon={Clock}
          stats={[
            { label: "Total OT", value: "320 h" },
            { label: "Employee", value: "201" },
          ]}
        />
      </div>
    </div>
  );
}
