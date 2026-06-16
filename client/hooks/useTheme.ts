import { Colors } from "@/constants/theme";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

export function useTheme() {
  const { theme, isDarkMode } = useThemePreference();
  const themeKey =
    theme === "power" ? "power" : theme === "light" ? "light" : "dark";
  const resolvedTheme = Colors[themeKey];

  return {
    theme: resolvedTheme,
    isDark: isDarkMode,
  };
}
