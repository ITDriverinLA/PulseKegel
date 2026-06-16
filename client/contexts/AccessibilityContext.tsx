import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { storage } from "../lib/storage";
import { useThemePreference } from "./ThemePreferenceContext";
import { useStartup } from "./StartupContext";

interface AccessibilityContextType {
  highContrast: boolean;
  largeText: boolean;
  fontScale: number;
  colors: {
    text: string;
    textSecondary: string;
    accent: string;
    accentSecondary: string;
    background: string;
    cardBackground: string;
    border: string;
  };
  refresh: () => Promise<void>;
}

const darkDefaultColors = {
  text: "rgba(255,255,255,0.9)",
  textSecondary: "rgba(255,255,255,0.6)",
  accent: "#00FF88",
  accentSecondary: "#00FFFF",
  background: "#0a0a1a",
  cardBackground: "rgba(26, 26, 46, 0.8)",
  border: "rgba(0, 255, 136, 0.2)",
};

const darkHighContrastColors = {
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.85)",
  accent: "#00FF88",
  accentSecondary: "#00FFFF",
  background: "#000000",
  cardBackground: "rgba(40, 40, 60, 0.95)",
  border: "rgba(0, 255, 136, 0.5)",
};

const lightDefaultColors = {
  text: "#1a1a2e",
  textSecondary: "rgba(0,0,0,0.55)",
  accent: "#00B86B",
  accentSecondary: "#0099CC",
  background: "#f0f2f7",
  cardBackground: "rgba(255, 255, 255, 0.85)",
  border: "rgba(0, 184, 107, 0.2)",
};

const lightHighContrastColors = {
  text: "#000000",
  textSecondary: "rgba(0,0,0,0.75)",
  accent: "#008A50",
  accentSecondary: "#006699",
  background: "#ffffff",
  cardBackground: "rgba(240, 240, 245, 0.95)",
  border: "rgba(0, 138, 80, 0.5)",
};

const AccessibilityContext = createContext<AccessibilityContextType>({
  highContrast: false,
  largeText: false,
  fontScale: 1,
  colors: darkDefaultColors,
  refresh: async () => {},
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { initialSettings } = useStartup();
  const [highContrast, setHighContrast] = useState(initialSettings.highContrastMode);
  const [largeText, setLargeText] = useState(initialSettings.largeTextMode);
  const { isDarkMode } = useThemePreference();

  const loadSettings = async () => {
    const settings = await storage.getSettings();
    setHighContrast(settings.highContrastMode);
    setLargeText(settings.largeTextMode);
  };

  const fontScale = largeText ? 1.25 : 1;

  let colors;
  if (isDarkMode) {
    colors = highContrast ? darkHighContrastColors : darkDefaultColors;
  } else {
    colors = highContrast ? lightHighContrastColors : lightDefaultColors;
  }

  return (
    <AccessibilityContext.Provider
      value={{
        highContrast,
        largeText,
        fontScale,
        colors,
        refresh: loadSettings,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
