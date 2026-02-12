import { Platform } from "react-native";

export const AppColors = {
  primary: "#4A90E2",
  background: "#FFFFFF",
  surface: "#F7F9FC",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280",
  success: "#10B981",
  warning: "#F59E0B",
  squeeze: "#E94A4A",
  rest: "#10B981",
  border: "#E5E7EB",
};

const tintColorLight = AppColors.primary;
const tintColorDark = "#5A9FF2";

export const Colors = {
  light: {
    text: "#1a1a2e",
    textSecondary: "#5a5a7a",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8a8aaa",
    tabIconSelected: "#00B86B",
    link: "#0099CC",
    backgroundRoot: "#f0f2f7",
    backgroundDefault: "#e8eaf0",
    backgroundSecondary: "#dde0e8",
    backgroundTertiary: "#d0d4de",
    border: "#c8ccd8",
    success: "#00B86B",
    warning: "#E6A800",
    squeeze: "#E6234E",
    rest: "#00B86B",
    primary: "#00B86B",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#666688",
    tabIconSelected: "#00FF88",
    link: "#00FFFF",
    backgroundRoot: "#0a0a1a",
    backgroundDefault: "#12122a",
    backgroundSecondary: "#1a1a3a",
    backgroundTertiary: "#22224a",
    border: "#2a2a4a",
    success: "#00FF88",
    warning: "#F59E0B",
    squeeze: "#FF3366",
    rest: "#00FF88",
    primary: "#00FF88",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  stateLabel: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: "700" as const,
  },
  countdown: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "600" as const,
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
