import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../lib/storage';

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

const defaultColors = {
  text: 'rgba(255,255,255,0.9)',
  textSecondary: 'rgba(255,255,255,0.6)',
  accent: '#00FF88',
  accentSecondary: '#00FFFF',
  background: '#0a0a1a',
  cardBackground: 'rgba(26, 26, 46, 0.8)',
  border: 'rgba(0, 255, 136, 0.2)',
};

const highContrastColors = {
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.85)',
  accent: '#00FF88',
  accentSecondary: '#00FFFF',
  background: '#000000',
  cardBackground: 'rgba(40, 40, 60, 0.95)',
  border: 'rgba(0, 255, 136, 0.5)',
};

const AccessibilityContext = createContext<AccessibilityContextType>({
  highContrast: false,
  largeText: false,
  fontScale: 1,
  colors: defaultColors,
  refresh: async () => {},
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const loadSettings = async () => {
    const settings = await storage.getSettings();
    setHighContrast(settings.highContrastMode);
    setLargeText(settings.largeTextMode);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const fontScale = largeText ? 1.25 : 1;
  const colors = highContrast ? highContrastColors : defaultColors;

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
