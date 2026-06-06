"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const LangContext = createContext(null);

export function useTheme() { return useContext(ThemeContext); }
export function useLang() { return useContext(LangContext); }

export default function AppProviders({ children }) {
  const [theme, setTheme] = useState("gas-dark");
  const [lang, setLang] = useState("id");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("gas-theme") || "gas-dark";
    const savedLang = localStorage.getItem("gas-lang") || "id";
    setTheme(savedTheme);
    setLang(savedLang);
    document.documentElement.setAttribute("data-theme", savedTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "gas-dark" ? "gas-light" : "gas-dark";
    setTheme(next);
    localStorage.setItem("gas-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const toggleLang = () => {
    const next = lang === "id" ? "en" : "id";
    setLang(next);
    localStorage.setItem("gas-lang", next);
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "gas-dark" }}>
      <LangContext.Provider value={{ lang, toggleLang }}>
        {children}
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
