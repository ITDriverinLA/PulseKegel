import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator, {
  RootStackParamList,
} from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/contexts/ThemePreferenceContext";
import { StartupProvider, useStartup } from "@/contexts/StartupContext";
import { scheduleDailyReminder } from "@/lib/notifications";
import { trackAppOpen, trackChallengeDay2NudgeTapped } from "@/lib/analytics";
import { markColdLaunch, markWarmResume } from "@/lib/activationDiagnostics";
import {
  cancelChallengeDay2Nudge,
  markPushDay2NudgeShown,
} from "@/lib/challengeNudge";
import { storage } from "@/lib/storage";
import { getWeek1WorkoutForDayIndex } from "@/data/workoutProgram";
import { didAppBecomeActive } from "@/lib/appState";

SplashScreen.preventAutoHideAsync().catch(() => {});

markColdLaunch();

function parseChallengeDayLink(
  url: string | null,
): { week: number; day: number } | null {
  if (!url) return null;
  const match = url.match(/challenge\/day\/(\d+)/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  if (!Number.isFinite(day) || day < 1 || day > 7) return null;
  return { week: 1, day };
}

async function openChallengeDay(
  navigation: NavigationContainerRef<RootStackParamList> | null,
  week: number,
  day: number,
  channel: "push" | "in_app",
) {
  trackChallengeDay2NudgeTapped({ channel });
  await cancelChallengeDay2Nudge();

  if (!navigation) return;
  const hasFirst = await storage.hasCompletedFirstSession();
  if (!hasFirst) return;

  const calib = await storage.getCalibrationState();
  const workout = getWeek1WorkoutForDayIndex(day - 1, calib.difficultyPath);
  if (workout.isRestDay) {
    navigation.navigate("Main");
    return;
  }
  navigation.navigate("WorkoutPlayer", {
    workout,
    weekNumber: week,
    phase: "Control",
    dayNumber: day,
  });
}

function AppContent() {
  const { cp } = useThemePreference();
  const { initialSettings, initialProgress, programStartDate } = useStartup();
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    (async () => {
      try {
        if (initialSettings.reminderEnabled) {
          await scheduleDailyReminder(initialSettings.reminderTime);
        }
      } catch {}
    })();

    try {
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
        streak: initialProgress.currentStreak,
        totalSessions: initialProgress.totalSessions,
        anatomyType: initialSettings.anatomyType,
      });
    } catch {}
  }, [initialSettings, initialProgress, programStartDate]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (didAppBecomeActive(appStateRef.current, next)) {
        markWarmResume();
      }
      appStateRef.current = next;
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as {
        screen?: string;
        week?: number;
        day?: number;
        nudge?: string;
      };
      if (data?.nudge === "day2" || data?.screen === "ChallengeDay") {
        void markPushDay2NudgeShown();
        void openChallengeDay(
          navigationRef.current,
          Number(data.week) || 1,
          Number(data.day) || 2,
          "push",
        );
      }
    };

    const sub =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});

    const onUrl = (event: { url: string }) => {
      const parsed = parseChallengeDayLink(event.url);
      if (parsed) {
        void openChallengeDay(
          navigationRef.current,
          parsed.week,
          parsed.day,
          "in_app",
        );
      }
    };
    const linkSub = Linking.addEventListener("url", onUrl);
    Linking.getInitialURL()
      .then((url) => {
        const parsed = parseChallengeDayLink(url);
        if (parsed) {
          void openChallengeDay(
            navigationRef.current,
            parsed.week,
            parsed.day,
            "in_app",
          );
        }
      })
      .catch(() => {});

    return () => {
      sub.remove();
      linkSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <NavigationContainer ref={navigationRef}>
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
          <StartupProvider>
            <ThemePreferenceProvider>
              <AccessibilityProvider>
                <AudioProvider>
                  <AppContent />
                </AudioProvider>
              </AccessibilityProvider>
            </ThemePreferenceProvider>
          </StartupProvider>
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
