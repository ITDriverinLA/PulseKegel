import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import MainTabNavigator from '@/navigation/MainTabNavigator';
import WorkoutPlayerScreen from '@/screens/WorkoutPlayerScreen';
import WorkoutPickerScreen from '@/screens/WorkoutPickerScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import ChallengeCompleteScreen from '@/screens/ChallengeCompleteScreen';
import Week1ReviewScreen from '@/screens/Week1ReviewScreen';
import MusicScreen from '@/screens/MusicScreen';
import BreathworkModeSelectorScreen from '@/screens/BreathworkModeSelectorScreen';
import BreathworkSessionScreen from '@/screens/BreathworkSessionScreen';
import BreathworkSummaryScreen from '@/screens/BreathworkSummaryScreen';
import TechniqueGuideScreen from '@/screens/TechniqueGuideScreen';
import ForceUpdateScreen from '@/screens/ForceUpdateScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';
import { storage } from '@/lib/storage';
import { getApiUrl } from '@/lib/query-client';
import { DayTemplate } from '@/data/workoutProgram';
import { BreathworkMode } from '@/constants/breathworkModes';

export type RootStackParamList = {
  Main: undefined;
  WorkoutPlayer: {
    workout: DayTemplate;
    weekNumber: number;
    phase: string;
    dayNumber?: number;
  };
  WorkoutPicker: undefined;
  Onboarding: undefined;
  Paywall: undefined;
  ChallengeComplete: undefined;
  Week1Review: undefined;
  Music: undefined;
  BreathworkModeSelector: undefined;
  BreathworkSession: { mode: BreathworkMode };
  BreathworkSummary: { mode: BreathworkMode; completed: boolean };
  TechniqueGuide: undefined;
};

interface StoreUrls {
  iosStoreUrl: string;
  androidStoreUrl: string;
}

/**
 * Returns true if `current` is strictly older than `minimum`.
 * Compares semver segments left-to-right numerically.
 */
function isVersionOutdated(current: string, minimum: string): boolean {
  const curr = current.split('.').map(n => parseInt(n, 10));
  const min = minimum.split('.').map(n => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const c = curr[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const fadeOpacity = useSharedValue(0);
  const [storeUrls, setStoreUrls] = useState<StoreUrls>({
    iosStoreUrl: 'https://apps.apple.com/app/pulsekegel',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.pulsekegel.app',
  });

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    const [onboardingComplete] = await Promise.all([
      storage.isOnboardingComplete(),
      checkVersion(),
    ]);
    setShowOnboarding(!onboardingComplete);
    setIsLoading(false);
  };

  const checkVersion = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const url = new URL('/api/version-check', getApiUrl()).toString();
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const data = await res.json();
      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
      const minimumVersion = typeof data.minimumVersion === 'string' ? data.minimumVersion : '0.0.0';
      if (isVersionOutdated(currentVersion, minimumVersion)) {
        setNeedsUpdate(true);
        if (data.iosStoreUrl || data.androidStoreUrl) {
          setStoreUrls({
            iosStoreUrl: data.iosStoreUrl ?? storeUrls.iosStoreUrl,
            androidStoreUrl: data.androidStoreUrl ?? storeUrls.androidStoreUrl,
          });
        }
      }
    } catch {
      // Network error or timeout — fail open, never block the user
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (!isLoading && !showOnboarding && !needsUpdate) {
      fadeOpacity.value = 0;
      fadeOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isLoading, showOnboarding, needsUpdate]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    flex: 1,
  }));

  const handleOnboardingComplete = async () => {
    await storage.setOnboardingComplete();
    setShowOnboarding(false);
  };

  if (isLoading) {
    return null;
  }

  if (needsUpdate) {
    return (
      <ForceUpdateScreen
        iosStoreUrl={storeUrls.iosStoreUrl}
        androidStoreUrl={storeUrls.androidStoreUrl}
      />
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <Animated.View style={fadeStyle}>
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WorkoutPlayer"
        component={WorkoutPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="WorkoutPicker"
        component={WorkoutPickerScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Week1Review"
        component={Week1ReviewScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChallengeComplete"
        component={ChallengeCompleteScreen}
        options={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 350,
        }}
      />
      <Stack.Screen
        name="Music"
        component={MusicScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BreathworkModeSelector"
        component={BreathworkModeSelectorScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BreathworkSession"
        component={BreathworkSessionScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="BreathworkSummary"
        component={BreathworkSummaryScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'fade',
          animationDuration: 350,
        }}
      />
      <Stack.Screen
        name="TechniqueGuide"
        component={TechniqueGuideScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
    </Animated.View>
  );
}
