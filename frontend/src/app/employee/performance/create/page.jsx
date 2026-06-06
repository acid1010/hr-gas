"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useAppSettings } from "@/lib/useAppSettings";

export default function PerformanceCreatePage() {
  const { p } = useAppSettings();
  const router  = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = Object.fromEntries(new FormData(e.target).entries());
      await fetchWithAuth(`${apiBaseUrl}/api/performance/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.push("/employee/performance");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-center gap-4"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150"
            style={{ background: p.cardBg, border: `1px solid ${p.border}`, color: p.muted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = p.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.color = p.muted; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>
              Performance
            </p>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
              Add Record
            </h1>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg rounded-2xl overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <div className="px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${p.border}` }}>
            <p className="text-sm font-bold" style={{ color: p.muted }}>Fill in the employee performance data for the quarter</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
            <PerformanceForm />
            <motion.button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-black text-white mt-2"
              style={{ background: saving ? "#1e2d52" : "#3b6fd4", cursor: saving ? "not-allowed" : "pointer" }}
              whileHover={!saving ? { scale: 1.012, backgroundColor: "#2f5cb8" } : {}}
              whileTap={!saving ? { scale: 0.985 } : {}}
              transition={{ duration: 0.15 }}
            >
              {saving ? "Saving…" : "Save Record"}
            </motion.button>
          </form>
        </motion.div>

      </div>
    </main>
  );
}
