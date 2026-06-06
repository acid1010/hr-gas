"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, CalendarClock, FileSpreadsheet, Users, Hourglass } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

const PLANNED = [
  { icon: Clock,            title: "Log Overtime",       desc: "Record employee overtime hours with approval workflow" },
  { icon: CalendarClock,    title: "Monthly Summary",    desc: "Aggregate overtime per employee per month with pay calculation" },
  { icon: FileSpreadsheet,  title: "Excel Export",       desc: "Export overtime reports in XLSX format for payroll" },
  { icon: Users,            title: "Department View",    desc: "Track overtime distribution across departments" },
];

const cardVariants = {
  hidden:   { opacity: 0, y: 20 },
  visible:  (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.48, ease: [0.22, 1, 0.36, 1] } }),
};

export default function OvertimePage() {
  const { p } = useAppSettings();
  const router = useRouter();

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 flex items-center gap-4"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 shrink-0"
            style={{ background: p.cardBg, border: `1px solid ${p.border}`, color: p.muted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = p.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.color = p.muted; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>
              HR Management
            </p>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
              Overtime
            </h1>
          </div>
        </motion.div>

        {/* Under construction hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl mb-8 flex flex-col items-center justify-center text-center py-20 px-8"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(91,141,248,0.06), transparent 70%)" }} />

          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-7"
            style={{ background: "rgba(91,141,248,0.1)", border: "1px solid rgba(91,141,248,0.18)" }}
          >
            <Hourglass size={36} style={{ color: "#5b8df8" }} />
          </motion.div>

          <p className="text-[10px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: "#5b8df8" }}>
            Coming Soon
          </p>
          <h2 className="text-3xl font-black tracking-tight mb-4" style={{ color: p.text }}>
            Overtime Tracking
          </h2>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: p.muted }}>
            Overtime management is currently in development. Log, approve, and report employee overtime hours — integrated with payroll.
          </p>

          {/* Progress indicator */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-1.5 rounded-full overflow-hidden w-48" style={{ background: p.border }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #3b6fd4, #5b8df8)" }}
                initial={{ width: 0 }}
                animate={{ width: "40%" }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              />
            </div>
            <span className="text-xs font-black tabular-nums" style={{ color: p.faint }}>40%</span>
          </div>
        </motion.div>

        {/* Planned features grid */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-[10px] font-black tracking-[0.25em] uppercase mb-4"
          style={{ color: p.faint }}
        >
          Planned Features
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANNED.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="rounded-2xl p-5 flex flex-col gap-3 transition-colors duration-150"
              style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; e.currentTarget.style.background = p.rowHover; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.background = p.cardBg; }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(91,141,248,0.1)" }}>
                <Icon size={17} style={{ color: "#5b8df8" }} />
              </div>
              <div>
                <p className="text-sm font-black mb-1" style={{ color: p.text }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: p.faint }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </main>
  );
}
