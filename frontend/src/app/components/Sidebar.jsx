"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, TrendingUp, Clock, CalendarClock, Fingerprint, LogOut, Sun, Moon, Search } from "lucide-react";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useTheme, useLang } from "./AppProviders";
import { t } from "@/lib/i18n";

export default function Sidebar({ user }) {
  const pathname   = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang }    = useLang();

  const navItems = [
    { href: "/dashboard",            label: t(lang, "nav.dashboard"),   icon: LayoutDashboard, shortcut: "⌘1" },
    { href: "/employee",             label: t(lang, "nav.employee"),    icon: Users, exact: true, shortcut: "⌘2" },
    { href: "/attendance",           label: t(lang, "nav.attendance"),  icon: Fingerprint, shortcut: "⌘3" },
    { href: "/employee/performance", label: t(lang, "nav.performance"), icon: TrendingUp, shortcut: "⌘4" },
    { href: "/overtime",             label: t(lang, "nav.overtime"),    icon: Clock, shortcut: "⌘5" },
    { href: "/shifts",               label: t(lang, "nav.shifts"),      icon: CalendarClock, shortcut: "⌘6" },
  ];

  const isActive = (href, exact) => {
    if (exact) return pathname === href || pathname === href + "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  const bg         = isDark ? "#10131c"                     : "#ffffff";
  const border     = isDark ? "rgba(255,255,255,0.06)"      : "rgba(0,0,0,0.07)";
  const mutedText  = isDark ? "#6b7a99"                     : "#64748b";
  const activeText = "#5b8df8";
  const activeBg   = isDark ? "rgba(91,141,248,0.12)"       : "#dce6fb";
  const hoverBg    = isDark ? "#161c2b"                     : "#f1f5ff";
  const textColor  = isDark ? "#c9d1e0"                     : "#1a2035";
  const chipBg     = isDark ? "#161c2b"                     : "#f0f2f7";
  const chipBorder = isDark ? "rgba(255,255,255,0.08)"      : "rgba(0,0,0,0.08)";
  const userBg     = isDark ? "rgba(255,255,255,0.025)"     : "rgba(0,0,0,0.025)";

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transition-colors duration-200"
      style={{ background: bg, borderRight: `1px solid ${border}` }}
    >
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="p-5 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ boxShadow: "0 0 18px rgba(59,111,212,0.38)" }}>
            <Image src="/logo.png" alt="PT GAS" width={40} height={40} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          </div>
          <div>
            <p className="text-xs font-black tracking-widest uppercase leading-tight" style={{ color: textColor }}>
              PT. Global Anugerah Setia
            </p>
            <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: mutedText }}>
              {t(lang, "nav.hrManagement")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Cmd+K search trigger */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("gas:cmd"))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
          style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; e.currentTarget.style.color = textColor; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = chipBorder; e.currentTarget.style.color = mutedText; }}
        >
          <Search size={13} style={{ flexShrink: 0 }} />
          <span className="flex-1 text-left">Search…</span>
          <div className="flex items-center gap-0.5">
            <kbd className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: mutedText }}>⌘</kbd>
            <kbd className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: mutedText }}>K</kbd>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, icon: Icon, exact, shortcut, badge }, i) => {
            const active = isActive(href, exact);
            return (
              <motion.div
                key={href}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.055 + 0.1, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="group/nav"
              >
                <Link
                  href={href}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150"
                  style={{ color: active ? activeText : mutedText, fontWeight: active ? 700 : 500 }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = textColor; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ""; e.currentTarget.style.color = mutedText; } }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: activeBg }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}

                  <Icon size={16} className="relative z-10 shrink-0" />
                  <span className="relative z-10 flex-1">{label}</span>

                  {/* Badge (Soon, Beta, etc.) */}
                  {badge && !active && (
                    <span
                      className="relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase"
                      style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      {badge}
                    </span>
                  )}

                  {/* Keyboard shortcut hint — visible on hover */}
                  {!badge && !active && shortcut && (
                    <kbd
                      className="relative z-10 text-[9px] font-black px-1 py-0.5 rounded opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150"
                      style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
                    >
                      {shortcut}
                    </kbd>
                  )}

                  {active && (
                    <motion.div
                      layoutId="nav-active-dot"
                      className="relative z-10 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "#5b8df8" }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>

      {/* Controls: theme + lang */}
      <div className="px-3 pb-2 flex items-center gap-2 shrink-0">
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light" : "Switch to Dark"}
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150"
          style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
          onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = mutedText; e.currentTarget.style.borderColor = chipBorder; }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={toggleLang}
          className="flex-1 flex items-center justify-center h-9 rounded-xl text-xs font-black tracking-widest transition-all duration-150"
          style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
          onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = mutedText; e.currentTarget.style.borderColor = chipBorder; }}
        >
          {lang === "id" ? "EN" : "ID"}
        </button>
      </div>

      {/* User + Logout */}
      <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5" style={{ background: userBg }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 text-white"
              style={{ background: "#3b6fd4" }}
            >
              {(user.name || user.username || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate leading-snug" style={{ color: textColor }}>
                {user.name || user.username}
              </p>
              <span
                className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md inline-block mt-0.5"
                style={{ background: "rgba(91,141,248,0.12)", color: "#5b8df8" }}
              >
                {user.role || "user"}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{ color: "#ef4444" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ""; }}
        >
          <LogOut size={15} />
          {t(lang, "nav.logout")}
        </button>
      </div>
    </aside>
  );
}
