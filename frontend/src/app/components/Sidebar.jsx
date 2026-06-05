"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, TrendingUp, Clock, LogOut } from "lucide-react";
import apiBaseUrl from "@/lib/urlEndPoint";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee", label: "Employee", icon: Users, exact: true },
  { href: "/employee/performance", label: "Performance", icon: TrendingUp },
  { href: "/overtime", label: "Overtime", icon: Clock },
];

export default function Sidebar({ user }) {
  const pathname = usePathname();

  const isActive = (href, exact) => {
    if (exact) return pathname === href || pathname === href + "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50"
      style={{ background: "#10131c", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Brand */}
      <div className="p-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
            style={{ background: "#3b6fd4" }}
          >
            GAS
          </div>
          <div>
            <p className="text-xs font-black text-white tracking-widest uppercase leading-tight">
              PT. Global Anugerah Setia
            </p>
            <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "#4a5568" }}>
              HR Management
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
              style={
                active
                  ? { background: "#1e2d52", color: "#5b8df8", borderLeft: "2px solid #5b8df8" }
                  : { color: "#6b7a99" }
              }
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#161c2b"; e.currentTarget.style.color = "#c9d1e0"; }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#6b7a99"; } }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "#1e2d52", color: "#5b8df8" }}
            >
              {(user.name || user.username || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#c9d1e0" }}>
                {user.name || user.username}
              </p>
              <p className="text-xs truncate capitalize" style={{ color: "#4a5568" }}>
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
          Log Out
        </button>
      </div>
    </aside>
  );
}
