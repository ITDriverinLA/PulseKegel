import { Colors } from "@/constants/theme";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

export function useTheme() {
  const { isDarkMode } = useThemePreference();
  const theme = Colors[isDarkMode ? "dark" : "light"];

  return {
    theme,
    isDark: isDarkMode,
  };
}
