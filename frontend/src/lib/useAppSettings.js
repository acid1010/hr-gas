"use client";
import { useTheme } from "@/app/components/AppProviders";
import { useLang } from "@/app/components/AppProviders";
import { t as translate } from "./i18n";

export function useAppSettings() {
  const { isDark } = useTheme();
  const { lang } = useLang();

  const t = (path) => translate(lang, path);

  // Palette that switches with theme
  const p = {
    pageBg: isDark ? "#0b0d14" : "#f0f2f7",
    cardBg: isDark ? "#10131c" : "#ffffff",
    cardBg2: isDark ? "#12161f" : "#f8faff",
    rowAlt: isDark ? "#12161f" : "#f8faff",
    rowHover: isDark ? "#151a26" : "#f1f5ff",
    inputBg: isDark ? "#161c2b" : "#f0f2f7",
    border: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
    border2: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)",
    text: isDark ? "#c9d1e0" : "#1a2035",
    muted: isDark ? "#6b7a99" : "#64748b",
    faint: isDark ? "#4a5568" : "#94a3b8",
    accent: "#5b8df8",
    primary: "#3b6fd4",
  };

  return { isDark, lang, t, p };
}
