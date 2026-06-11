"use client";

import { useState } from "react";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useTheme } from "../components/AppProviders";
import { useLang } from "../components/AppProviders";
import { t } from "@/lib/i18n";
import { Sun, Moon, Eye, EyeOff, ArrowRight } from "lucide-react";

const STATS = [
  "Fingerprint Attendance Sync",
  "Real-time Performance Analytics",
  "ZKTeco X100-C Integration",
  "Multi-department Management",
  "Excel Report Export",
  "Enterprise HR Platform",
];

export default function Login() {
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Palette
  const pageBg    = isDark ? "#0b0d14"                    : "#f0f2f7";
  const inputBg   = isDark ? "#0d0f18"                    : "#f4f6fb";
  const border    = isDark ? "rgba(255,255,255,0.07)"     : "rgba(0,0,0,0.08)";
  const inBorder  = isDark ? "rgba(255,255,255,0.09)"     : "rgba(0,0,0,0.1)";
  const textColor = isDark ? "#e2e8f0"                    : "#1a2035";
  const muted     = isDark ? "#4a5568"                    : "#64748b";
  const labelClr  = isDark ? "#6b7a99"                    : "#64748b";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())),
        credentials: "include",
      });
      if (!result.ok) {
        const err = await result.json();
        setError(err.error || "Login failed");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError(lang === "id" ? "Tidak dapat terhubung ke server" : "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="flex min-h-screen w-full transition-colors duration-300" style={{ background: pageBg }}>

        {/* LEFT PANEL — atmospheric editorial split */}
        <div
          className="fade-up hidden lg:flex lg:w-[58%] xl:w-[60%] relative flex-col overflow-hidden"
          style={{ background: "#060810" }}
        >
          {/* Atmospheric background */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url(https://picsum.photos/seed/factory/1920/1080)",
              filter: "grayscale(100%) contrast(1.1) brightness(0.25)",
            }}
          />

          {/* Radial gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 25% 50%, rgba(59,111,212,0.09) 0%, rgba(6,8,16,0.82) 65%)",
            }}
          />

          {/* Bottom fade for marquee */}
          <div
            className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(6,8,16,0.96) 0%, transparent 100%)" }}
          />

          {/* Panel content */}
          <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">

            {/* Brand lockup */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: "#3b6fd4" }}>
                GAS
              </div>
              <div>
                <p className="text-sm font-black tracking-widest uppercase leading-none text-white">
                  PT. Global Anugerah Setia
                </p>
                <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>
                  Human Resources
                </p>
              </div>
            </div>

            {/* Center tagline — max 2 lines guaranteed at clamp(2.4rem,4vw,3.5rem) */}
            <div className="flex-1 flex flex-col justify-center">
              <p
                className="text-[10px] font-black tracking-[0.3em] uppercase mb-5"
                style={{ color: "#5b8df8" }}
              >
                HR Management System
              </p>

              <h2
                className="font-black leading-[1.06] tracking-tight text-white"
                style={{ fontSize: "clamp(2.4rem, 3.8vw, 3.5rem)", maxWidth: 500 }}
              >
                Managing People,<br />
                <span style={{ color: "#5b8df8" }}>Driving</span> Performance.
              </h2>

              <p className="mt-6 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.36)", maxWidth: 380 }}>
                Integrated fingerprint attendance, real-time workforce analytics, and performance management — built for PT. Global Anugerah Setia.
              </p>

              {/* Divider */}
              <div className="mt-10 w-12 h-px" style={{ background: "rgba(91,141,248,0.4)" }} />
            </div>

            {/* Marquee stats strip */}
            <div className="overflow-hidden">
              <div
                className="flex whitespace-nowrap"
                style={{ animation: "marquee-panel 22s linear infinite" }}
              >
                {[...STATS, ...STATS, ...STATS].map((s, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-semibold px-5"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {s}
                    <span className="ml-5" style={{ color: "rgba(59,111,212,0.6)" }}>·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — login form */}
        <div className="flex-1 flex flex-col relative">

          {/* Top-right controls */}
          <div className="absolute top-5 right-5 flex items-center gap-2 z-20">
            <button
              onClick={toggleLang}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black tracking-widest uppercase transition-all"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${border}`, color: muted }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.45)"; e.currentTarget.style.color = textColor; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted; }}
            >
              {lang === "id" ? "EN" : "ID"}
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${border}`, color: muted }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.45)"; e.currentTarget.style.color = textColor; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted; }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          {/* Centered form */}
          <div className="flex-1 flex items-center justify-center px-8 py-20">
            <div
              className="fade-up w-full"
              style={{ maxWidth: 388 }}
            >

              {/* Mobile brand (hidden on lg) */}
              <div className="fade-up flex items-center gap-3 mb-10 lg:hidden">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white" style={{ background: "#3b6fd4" }}>
                  GAS
                </div>
                <p className="text-sm font-black tracking-widest uppercase" style={{ color: textColor }}>
                  PT. Global Anugerah Setia
                </p>
              </div>

              {/* Page heading */}
              <div className="fade-up mb-9">
                <h1 className="text-[2.4rem] font-black tracking-tight leading-none mb-2.5" style={{ color: textColor }}>
                  {t(lang, "login.title")}
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: muted }}>
                  {t(lang, "login.subtitle")}
                </p>
              </div>

              {/* Inline error */}
              {error && (
                <div
                  className="fade-up mb-6 px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    color: "#ef4444",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* Username */}
                <div className="fade-up flex flex-col gap-2">
                  <label className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: labelClr }}>
                    {t(lang, "login.username")}
                  </label>
                  <input
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder={lang === "id" ? "Nama pengguna" : "Username"}
                    className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: inputBg, border: `1.5px solid ${inBorder}`, color: textColor, caretColor: "#5b8df8" }}
                    onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.11)"; }}
                    onBlur={e =>  { e.target.style.borderColor = inBorder;   e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Password */}
                <div className="fade-up flex flex-col gap-2">
                  <label className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: labelClr }}>
                    {t(lang, "login.password")}
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPass ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder={lang === "id" ? "Kata sandi" : "Password"}
                      className="w-full pl-4 pr-11 py-3.5 rounded-xl text-sm outline-none transition-all"
                      style={{ background: inputBg, border: `1.5px solid ${inBorder}`, color: textColor, caretColor: "#5b8df8" }}
                      onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.11)"; }}
                      onBlur={e =>  { e.target.style.borderColor = inBorder;   e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: muted }}
                      onMouseEnter={e => { e.currentTarget.style.color = textColor; }}
                      onMouseLeave={e => { e.currentTarget.style.color = muted; }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="fade-up pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide text-white flex items-center justify-center gap-2"
                    style={{ background: "#3b6fd4", cursor: loading ? "not-allowed" : "pointer" }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#fff" }}
                        />
                        <span>{lang === "id" ? "Memuat…" : "Signing in…"}</span>
                      </>
                    ) : (
                      <>
                        <span>{t(lang, "login.submit")}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <p className="fade-up mt-9 text-center text-xs" style={{ color: muted }}>
                {t(lang, "login.footer")}
              </p>

            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee-panel {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
      `}</style>
    </main>
  );
}
