"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Toaster from "./Toaster"
import CommandPalette from "./CommandPalette";

const ThemeContext = createContext(null);
const LangContext = createContext(null);

export function useTheme() { return useContext(ThemeContext); }
export function useLang() { return useContext(LangContext); }

export default function AppProviders({ children }) {
  const [theme, setTheme] = useState("gas-light");
  const [lang, setLang] = useState("id");

  useEffect(() => {
    const savedTheme = localStorage.getItem("gas-theme") || "gas-light";
    const savedLang = localStorage.getItem("gas-lang") || "id";
    setTheme(savedTheme);
    setLang(savedLang);
    document.documentElement.setAttribute("data-theme", savedTheme);
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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "gas-dark" }}>
      <LangContext.Provider value={{ lang, toggleLang }}>
        {children}
        <Toaster />
        <CommandPalette />
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
