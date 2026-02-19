"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext({
  theme: "dark" as Theme,
  toggle: () => {},
  setTheme: (t: Theme) => {},
});

export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem("fire-theme") : null;
      return (v as Theme) || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("fire-theme", theme);
    } catch {}
    // apply class on html element for global theming
    const el = document.documentElement;
    el.classList.remove("theme-light", "theme-dark");
    el.classList.add(theme === "light" ? "theme-light" : "theme-dark");
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggle = () => setThemeState((s) => (s === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}
