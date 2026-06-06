"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, TrendingUp, Clock, Fingerprint, LogOut, Sun, Moon } from "lucide-react";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useTheme } from "./AppProviders";
import { useLang } from "./AppProviders";
import { t } from "@/lib/i18n";

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();

  const navItems = [
    { href: "/dashboard", label: t(lang, "nav.dashboard"), icon: LayoutDashboard },
    { href: "/employee", label: t(lang, "nav.employee"), icon: Users, exact: true },
    { href: "/attendance", label: t(lang, "nav.attendance"), icon: Fingerprint },
    { href: "/employee/performance", label: t(lang, "nav.performance"), icon: TrendingUp },
    { href: "/overtime", label: t(lang, "nav.overtime"), icon: Clock },
  ];

  const isActive = (href, exact) => {
    if (exact) return pathname === href || pathname === href + "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  // Light/dark palette tokens
  const bg = isDark ? "#10131c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const mutedText = isDark ? "#6b7a99" : "#64748b";
  const activeText = "#5b8df8";
  const activeBg = isDark ? "#1e2d52" : "#dce6fb";
  const hoverBg = isDark ? "#161c2b" : "#f1f5ff";
  const textColor = isDark ? "#c9d1e0" : "#1a2035";
  const chipBg = isDark ? "#161c2b" : "#f0f2f7";
  const chipBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transition-colors duration-200"
      style={{ background: bg, borderRight: `1px solid ${border}` }}
    >
      {/* Brand */}
      <div className="p-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: "#3b6fd4" }}>
            GAS
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
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={active
                ? { background: activeBg, color: activeText, borderLeft: "2px solid #5b8df8" }
                : { color: mutedText }
              }
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = textColor; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ""; e.currentTarget.style.color = mutedText; } }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Controls: theme + lang */}
      <div className="px-3 pb-2 flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light" : "Switch to Dark"}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
          onMouseEnter={e => { e.currentTarget.style.color = textColor; }}
          onMouseLeave={e => { e.currentTarget.style.color = mutedText; }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          title="Toggle language"
          className="flex-1 flex items-center justify-center h-9 rounded-lg text-xs font-black tracking-widest transition-colors"
          style={{ background: chipBg, border: `1px solid ${chipBorder}`, color: mutedText }}
          onMouseEnter={e => { e.currentTarget.style.color = textColor; }}
          onMouseLeave={e => { e.currentTarget.style.color = mutedText; }}
        >
          {lang === "id" ? "EN" : "ID"}
        </button>
      </div>

      {/* User + Logout */}
      <div className="p-3" style={{ borderTop: `1px solid ${border}` }}>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: activeBg, color: activeText }}>
              {(user.name || user.username || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: textColor }}>
                {user.name || user.username}
              </p>
              <p className="text-xs truncate capitalize" style={{ color: mutedText }}>
                {user.role || "User"}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "#ef4444" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ""; }}
        >
          <LogOut size={16} />
          {t(lang, "nav.logout")}
        </button>
      </div>
    </aside>
  );
}
