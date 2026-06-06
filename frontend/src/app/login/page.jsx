"use client";
import { useState } from "react";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useTheme } from "../components/AppProviders";
import { useLang } from "../components/AppProviders";
import { t } from "@/lib/i18n";
import { Sun, Moon } from "lucide-react";

export default function Login() {
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();
  const [error, setError] = useState(null);

  const bg = isDark ? "#0b0d14" : "#f0f2f7";
  const cardBg = isDark ? "#10131c" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const inputBg = isDark ? "#161c2b" : "#f0f2f7";
  const inputBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)";
  const textColor = isDark ? "#c9d1e0" : "#1a2035";
  const mutedColor = isDark ? "#4a5568" : "#64748b";
  const labelColor = isDark ? "#6b7a99" : "#64748b";
  const inputText = isDark ? "#ffffff" : "#1a2035";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const result = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!result.ok) {
        const err = await result.json();
        setError(err.error || "Login gagal");
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Tidak dapat terhubung ke server");
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center relative transition-colors duration-200" style={{ background: bg }}>
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="px-3 py-1.5 rounded-lg text-xs font-black tracking-widest transition-colors"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: mutedColor }}
        >
          {lang === "id" ? "EN" : "ID"}
        </button>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: mutedColor }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <div className="w-full max-w-sm px-4">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0" style={{ background: "#3b6fd4" }}>
            GAS
          </div>
          <div>
            <p className="text-sm font-black tracking-widest uppercase leading-tight" style={{ color: textColor }}>
              PT. Global Anugerah Setia
            </p>
            <p className="text-[11px] tracking-widest uppercase mt-0.5" style={{ color: mutedColor }}>
              HR Management System
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 transition-colors duration-200" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <h2 className="text-xl font-bold mb-1" style={{ color: textColor }}>{t(lang, "login.title")}</h2>
          <p className="text-sm mb-6" style={{ color: mutedColor }}>{t(lang, "login.subtitle")}</p>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: labelColor }}>
                {t(lang, "login.username")}
              </label>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder={t(lang, "login.username")}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputText, caretColor: "#5b8df8" }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 2px rgba(91,141,248,0.15)"; }}
                onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: labelColor }}>
                {t(lang, "login.password")}
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder={t(lang, "login.password")}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputText, caretColor: "#5b8df8" }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 2px rgba(91,141,248,0.15)"; }}
                onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all mt-1"
              style={{ background: "#3b6fd4" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
            >
              {t(lang, "login.submit")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: mutedColor }}>
          {t(lang, "login.footer")}
        </p>
      </div>
    </div>
  );
}
