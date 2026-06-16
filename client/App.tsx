import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/contexts/ThemePreferenceContext";
import { storage } from "@/lib/storage";
import { scheduleDailyReminder } from "@/lib/notifications";
import { trackAppOpen } from "@/lib/analytics";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { cp } = useThemePreference();

  useEffect(() => {
    (async () => {
      try {
        const settings = await storage.getSettings();
        if (settings.reminderEnabled) {
          await scheduleDailyReminder(settings.reminderTime);
        }
      } catch {}
    })();

    (async () => {
      try {
        const [progress, settings, programStartDate] = await Promise.all([
          storage.getProgress(),
          storage.getSettings(),
          storage.getProgramStartDate(),
        ]);
        let programWeek: number | undefined;
        if (programStartDate) {
          const startMs = new Date(programStartDate).getTime();
          const diffDays = Math.floor(
            (Date.now() - startMs) / (1000 * 60 * 60 * 24),
          );
          programWeek = Math.min(Math.floor(diffDays / 7) + 1, 12);
        }
        trackAppOpen({
          programWeek,
          streak: progress.currentStreak,
          totalSessions: progress.totalSessions,
          anatomyType: settings.anatomyType,
        });
      } catch {}
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <NavigationContainer>
            <RootStackNavigator />
          </NavigationContainer>
          <StatusBar style={cp.statusBarStyle === "light" ? "light" : "dark"} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <ThemePreferenceProvider>
            <AccessibilityProvider>
              <AudioProvider>
                <AppContent />
              </AudioProvider>
            </AccessibilityProvider>
          </ThemePreferenceProvider>
        </SubscriptionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
