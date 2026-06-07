"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="relative flex flex-col w-[480px] h-full overflow-y-auto z-10"
            style={{ background: p.cardBg, borderLeft: `1px solid ${p.border}` }}
          >
            {/* Accent top bar */}
            <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

            {/* Header */}
            <div
              className="relative flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${p.border}` }}
            >
              {/* Subtle ambient glow behind title */}
              <div className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none" style={{ background: `linear-gradient(90deg, ${accent}08, transparent)` }} />
              <div className="relative">
                <h2 className="text-base font-black tracking-tight" style={{ color: p.text }}>{title}</h2>
                {subtitle && <p className="text-[11px] font-medium mt-0.5" style={{ color: p.faint }}>{subtitle}</p>}
              </div>
              <motion.button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors duration-150 shrink-0"
                style={{ color: p.faint }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                transition={{ duration: 0.15 }}
                onMouseEnter={e => { e.currentTarget.style.background = p.inputBg; e.currentTarget.style.color = p.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = p.faint; }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Content */}
            <motion.div
              className="flex-1 px-6 py-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
