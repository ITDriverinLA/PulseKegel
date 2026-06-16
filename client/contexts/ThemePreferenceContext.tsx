import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import * as SplashScreen from "expo-splash-screen";
import { storage, ThemeMode } from "../lib/storage";

export type { ThemeMode };

export interface CyberpunkColors {
  gradient: readonly [string, string, string, string];
  bg: string;
  cardBg: string;
  cardBorder: string;
  cardBgPressed: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  neonGreen: string;
  neonCyan: string;
  neonPink: string;
  neonPurple: string;
  neonOrange: string;
  overlay: string;
  inputBg: string;
  divider: string;
  tabBarBg: string;
  statusBarStyle: "light" | "dark";
}

const darkColors: CyberpunkColors = {
  gradient: ["#0a0a1a", "#1a0a2e", "#0a1a2e", "#0a0a1a"],
  bg: "#0a0a1a",
  cardBg: "rgba(255,255,255,0.05)",
  cardBorder: "rgba(255,255,255,0.1)",
  cardBgPressed: "rgba(255,255,255,0.1)",
  text: "#fff",
  textSecondary: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.4)",
  neonGreen: "#00FF88",
  neonCyan: "#00FFFF",
  neonPink: "#FF3366",
  neonPurple: "#9D4EDD",
  neonOrange: "#FF9500",
  overlay: "rgba(0,0,0,0.7)",
  inputBg: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.08)",
  tabBarBg: "rgba(10,10,26,0.92)",
  statusBarStyle: "light",
};

const lightColors: CyberpunkColors = {
  gradient: ["#f0f2f7", "#e6eaf5", "#eaf0f8", "#f0f2f7"],
  bg: "#f0f2f7",
  cardBg: "rgba(255,255,255,0.85)",
  cardBorder: "rgba(0,0,0,0.08)",
  cardBgPressed: "rgba(0,0,0,0.06)",
  text: "#1a1a2e",
  textSecondary: "rgba(0,0,0,0.55)",
  textMuted: "rgba(0,0,0,0.35)",
  neonGreen: "#00B86B",
  neonCyan: "#0099CC",
  neonPink: "#E6234E",
  neonPurple: "#7C3AED",
  neonOrange: "#D97706",
  overlay: "rgba(0,0,0,0.4)",
  inputBg: "rgba(0,0,0,0.04)",
  divider: "rgba(0,0,0,0.06)",
  tabBarBg: "rgba(240,242,247,0.92)",
  statusBarStyle: "dark",
};

const powerColors: CyberpunkColors = {
  gradient: ["#0E0E0E", "#130D1A", "#1A0E2A", "#0E0E0E"],
  bg: "#0E0E0E",
  cardBg: "rgba(139,92,246,0.07)",
  cardBorder: "rgba(139,92,246,0.18)",
  cardBgPressed: "rgba(139,92,246,0.14)",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.38)",
  neonGreen: "#8B5CF6",
  neonCyan: "#A78BFA",
  neonPink: "#C084FC",
  neonPurple: "#7C3AED",
  neonOrange: "#F59E0B",
  overlay: "rgba(0,0,0,0.78)",
  inputBg: "rgba(139,92,246,0.08)",
  divider: "rgba(139,92,246,0.14)",
  tabBarBg: "rgba(14,14,14,0.95)",
  statusBarStyle: "light",
};

function resolveColors(theme: ThemeMode): CyberpunkColors {
  if (theme === "light") return lightColors;
  if (theme === "power") return powerColors;
  return darkColors;
}

interface ThemePreferenceContextType {
  theme: ThemeMode;
  isDarkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  setTheme: (t: ThemeMode) => Promise<void>;
  cp: CyberpunkColors;
  refresh: () => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextType>({
  theme: "dark",
  isDarkMode: true,
  toggleDarkMode: async () => {},
  setTheme: async () => {},
  cp: darkColors,
  refresh: async () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [loaded, setLoaded] = useState(false);

  const loadTheme = useCallback(async () => {
    const settings = await storage.getSettings();
    setThemeState(settings.theme);
  }, []);

  useEffect(() => {
    (async () => {
      await loadTheme();
      setLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, [loadTheme]);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    await storage.saveSettings({
      theme: newTheme,
      darkMode: newTheme !== "light",
    });
  }, []);

  const toggleDarkMode = useCallback(async () => {
    const next: ThemeMode = theme !== "light" ? "light" : "dark";
    await setTheme(next);
  }, [theme, setTheme]);

  const isDarkMode = theme !== "light";
  const cp = resolveColors(theme);

  return (
    <ThemePreferenceContext.Provider
      value={{
        theme,
        isDarkMode,
        toggleDarkMode,
        setTheme,
        cp,
        refresh: loadTheme,
      }}
    >
      {loaded ? children : null}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
