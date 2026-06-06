"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

export default function NotFound() {
  const { p } = useAppSettings();
  const router = useRouter();

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div
        className="flex items-center justify-center min-h-screen px-8 transition-colors duration-300"
        style={{ background: p.pageBg }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center text-center max-w-sm w-full"
        >
          {/* Ambient glow behind icon */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(91,141,248,0.07), transparent 70%)" }}
          />

          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
            style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
          >
            <SearchX size={34} style={{ color: p.faint }} />
          </motion.div>

          {/* 404 numeral */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="font-black tabular-nums leading-none mb-3"
            style={{ fontSize: "clamp(4rem, 12vw, 7rem)", color: "rgba(91,141,248,0.18)", letterSpacing: "-0.04em" }}
          >
            404
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.45 }}
            className="text-xl font-black tracking-tight mb-2"
            style={{ color: p.text }}
          >
            Page Not Found
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.45 }}
            className="text-sm leading-relaxed mb-9"
            style={{ color: p.muted }}
          >
            The page you are looking for does not exist or has been moved.
          </motion.p>

          {/* Action */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white"
            style={{ background: "#3b6fd4" }}
            whileHover={{ scale: 1.02, backgroundColor: "#2f5cb8" }}
            whileTap={{ scale: 0.97 }}
          >
            <ArrowLeft size={15} />
            Back to Dashboard
          </motion.button>

        </motion.div>
      </div>
    </main>
  );
}
