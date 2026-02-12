import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { storage } from '../lib/storage';

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
  statusBarStyle: 'light' | 'dark';
}

const darkColors: CyberpunkColors = {
  gradient: ['#0a0a1a', '#1a0a2e', '#0a1a2e', '#0a0a1a'],
  bg: '#0a0a1a',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.1)',
  cardBgPressed: 'rgba(255,255,255,0.1)',
  text: '#fff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  neonGreen: '#00FF88',
  neonCyan: '#00FFFF',
  neonPink: '#FF3366',
  neonPurple: '#9D4EDD',
  neonOrange: '#FF9500',
  overlay: 'rgba(0,0,0,0.7)',
  inputBg: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.08)',
  tabBarBg: 'rgba(10,10,26,0.92)',
  statusBarStyle: 'light',
};

const lightColors: CyberpunkColors = {
  gradient: ['#f0f2f7', '#e6eaf5', '#eaf0f8', '#f0f2f7'],
  bg: '#f0f2f7',
  cardBg: 'rgba(255,255,255,0.85)',
  cardBorder: 'rgba(0,0,0,0.08)',
  cardBgPressed: 'rgba(0,0,0,0.06)',
  text: '#1a1a2e',
  textSecondary: 'rgba(0,0,0,0.55)',
  textMuted: 'rgba(0,0,0,0.35)',
  neonGreen: '#00B86B',
  neonCyan: '#0099CC',
  neonPink: '#E6234E',
  neonPurple: '#7C3AED',
  neonOrange: '#D97706',
  overlay: 'rgba(0,0,0,0.4)',
  inputBg: 'rgba(0,0,0,0.04)',
  divider: 'rgba(0,0,0,0.06)',
  tabBarBg: 'rgba(240,242,247,0.92)',
  statusBarStyle: 'dark',
};

interface ThemePreferenceContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  cp: CyberpunkColors;
  refresh: () => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextType>({
  isDarkMode: true,
  toggleDarkMode: async () => {},
  cp: darkColors,
  refresh: async () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const loadTheme = useCallback(async () => {
    const settings = await storage.getSettings();
    setIsDarkMode(settings.darkMode);
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const toggleDarkMode = useCallback(async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    const settings = await storage.getSettings();
    await storage.saveSettings({ ...settings, darkMode: newValue });
  }, [isDarkMode]);

  const cp = isDarkMode ? darkColors : lightColors;

  return (
    <ThemePreferenceContext.Provider
      value={{ isDarkMode, toggleDarkMode, cp, refresh: loadTheme }}
    >
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
